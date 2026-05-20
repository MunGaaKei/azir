import { useActivityStore } from "@/stores/activity";
import { createMessageId, createRandomProjectId, tryto } from "@/utils";
import { Message } from "@ioca/react";
import { create } from "zustand";
import type {
    ChatMessage,
    ChatProject,
    ChatStatus,
    ChatStore,
    ChatStoreSetter,
    ChatStreamEvent,
} from "./type";

export type { ChatMessage, ChatProject };

let currentController: AbortController | null = null;
let currentRequestId: string | null = null;
let currentMessageId: string | null = null;
const PENDING_ASSISTANT_PREFIX = "pending-assistant:";
const DEFAULT_PROJECT_ID = "default-project";
const DEFAULT_PROJECT: ChatProject = {
    id: DEFAULT_PROJECT_ID,
    name: "",
};

function createPendingAssistantId(requestId: string) {
    return `${PENDING_ASSISTANT_PREFIX}${requestId}`;
}

function createPendingAssistantMessage(
    requestId: string,
    projectId = DEFAULT_PROJECT_ID,
): ChatMessage {
    return {
        id: createPendingAssistantId(requestId),
        role: "assistant",
        content: "",
        status: "streaming",
        projectId,
        requestId,
    };
}

function updateMessage(
    messages: ChatMessage[],
    id: string,
    updater: (message: ChatMessage) => ChatMessage,
) {
    return messages.map((message) =>
        message.id === id ? updater(message) : message,
    );
}

function removePendingAssistantMessage(
    messages: ChatMessage[],
    requestId: string,
) {
    return messages.filter(
        (message) => message.id !== createPendingAssistantId(requestId),
    );
}

function hasActiveAssistantResponse(messages: ChatMessage[]) {
    return messages.some(
        (message) =>
            message.role === "assistant" && message.status === "streaming",
    );
}

function stopStreamingMessages(
    messages: ChatMessage[],
    messageId?: string | null,
    requestId?: string | null,
) {
    return messages.map((message) => {
        const shouldStop =
            message.status === "streaming" &&
            (!messageId || message.id === messageId) &&
            (!requestId || message.requestId === requestId);

        return shouldStop
            ? { ...message, status: "stopped" as const }
            : message;
    });
}

function finalizeIncompleteAssistantMessages(
    messages: ChatMessage[],
    requestId: string,
    fallbackContent: string,
) {
    return messages.map((message) => {
        if (message.requestId !== requestId || message.role !== "assistant") {
            return message;
        }

        if (message.status !== "streaming") {
            return message;
        }

        return {
            ...message,
            content: message.content || fallbackContent,
            status: "error" as const,
        };
    });
}

async function sendRequest(params: {
    prompt: string;
    agentIds?: number[];
    files?: Array<{
        name: string;
        base64: string;
        type: string;
    }>;
    userMessage: ChatMessage;
    optimisticMessages?: ChatMessage[];
    chatMode: boolean;
    set: ChatStoreSetter;
}) {
    const requestId = params.userMessage.requestId;
    if (!requestId) {
        return;
    }

    const controller = new AbortController();
    const decoder = new TextDecoder();
    let buffer = "";

    currentController = controller;
    currentRequestId = requestId;
    currentMessageId = createPendingAssistantId(requestId);
    params.set((state) => ({
        loading: true,
        messages: params.optimisticMessages ?? [
            ...state.messages,
            params.userMessage,
            createPendingAssistantMessage(requestId),
        ],
    }));

    const responseResult = await tryto(
        (async () => {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: params.prompt,
                    agentIds: params.agentIds ?? [],
                    requestId,
                    files: params.files ?? [],
                    chatMode: params.chatMode,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const message = (await response.text()) || "请求失败";
                throw new Error(message);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("响应流不可用");
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                if (!chunk) {
                    continue;
                }

                buffer += chunk;

                while (true) {
                    const separatorIndex = buffer.indexOf("\n\n");
                    if (separatorIndex < 0) {
                        break;
                    }

                    const rawEvent = buffer.slice(0, separatorIndex);
                    buffer = buffer.slice(separatorIndex + 2);

                    const event = await parseSseEvent(rawEvent);
                    if (!event) {
                        continue;
                    }

                    handleStreamEvent(event, params.set);
                }
            }

            params.set((state) => {
                const nextMessages = finalizeIncompleteAssistantMessages(
                    state.messages,
                    requestId,
                    "响应异常中断，请检查模型工具调用配置或稍后重试",
                );

                return {
                    loading: hasActiveAssistantResponse(nextMessages),
                    messages: nextMessages,
                };
            });
        })(),
    );

    if (responseResult.error) {
        const error = responseResult.error;
        const aborted = controller.signal.aborted;
        const message =
            error instanceof Error && error.message
                ? error.message
                : "网络异常，请稍后重试";

        if (aborted) {
            useActivityStore.getState().stopRunning();
            params.set((state) => ({
                loading: false,
                messages: stopStreamingMessages(
                    state.messages,
                    currentMessageId,
                    requestId,
                ),
            }));
        } else {
            params.set((state) => ({
                loading: false,
                messages: updateMessage(
                    state.messages,
                    createPendingAssistantId(requestId),
                    (currentMessage) => ({
                        ...currentMessage,
                        content: currentMessage.content || message,
                        status: "error",
                    }),
                ),
            }));
        }

        if (currentController === controller) {
            currentController = null;
            currentRequestId = null;
            currentMessageId = null;
        }

        if (!aborted) {
            Message.error(message);
            throw error;
        }
    }

    if (currentController === controller) {
        currentController = null;
        currentRequestId = null;
        currentMessageId = null;
    }
}

function upsertAssistantMessage(
    messages: ChatMessage[],
    payload: {
        id: string;
        requestId: string;
        agentId: number;
        agentName: string;
        status: ChatStatus;
    },
): ChatMessage[] {
    const exists = messages.some((message) => message.id === payload.id);
    if (exists) {
        return updateMessage(messages, payload.id, (message) => ({
            ...message,
            status: payload.status,
            requestId: payload.requestId,
            agentId: payload.agentId,
            agentName: payload.agentName,
        }));
    }

    return [
        ...messages,
        {
            id: payload.id,
            role: "assistant" as const,
            content: "",
            status: payload.status,
            projectId:
                messages.find(
                    (message) => message.requestId === payload.requestId,
                )?.projectId ?? DEFAULT_PROJECT_ID,
            requestId: payload.requestId,
            agentId: payload.agentId,
            agentName: payload.agentName,
        },
    ];
}

async function parseSseEvent(block: string): Promise<ChatStreamEvent | null> {
    const lines = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const data = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");

    if (!data) {
        return null;
    }

    const parsed = await tryto(
        Promise.resolve().then(() => JSON.parse(data) as ChatStreamEvent),
    );
    if (parsed.error) {
        return null;
    }

    return parsed.data;
}

function handleStreamEvent(event: ChatStreamEvent, set: ChatStoreSetter) {
    switch (event.type) {
        case "start": {
            useActivityStore.getState().start({
                id: event.activityId,
                requestId: event.requestId,
                agentId: event.agentId,
                agentName: event.agentName,
            });
            set((state) => {
                const nextMessages = upsertAssistantMessage(
                    removePendingAssistantMessage(
                        state.messages,
                        event.requestId,
                    ),
                    {
                        id: event.activityId,
                        requestId: event.requestId,
                        agentId: event.agentId,
                        agentName: event.agentName,
                        status: "streaming",
                    },
                );

                currentMessageId = event.activityId;

                return {
                    loading: hasActiveAssistantResponse(nextMessages),
                    messages: nextMessages,
                };
            });
            return;
        }
        case "append": {
            useActivityStore.getState().append({
                id: event.activityId,
                requestId: event.requestId,
                agentId: event.agentId,
                agentName: event.agentName,
            });
            set((state) => {
                const nextMessages = updateMessage(
                    upsertAssistantMessage(
                        removePendingAssistantMessage(
                            state.messages,
                            event.requestId,
                        ),
                        {
                            id: event.activityId,
                            requestId: event.requestId,
                            agentId: event.agentId,
                            agentName: event.agentName,
                            status: "streaming",
                        },
                    ),
                    event.activityId,
                    (message) => ({
                        ...message,
                        content: message.content + event.content,
                        status: "streaming",
                    }),
                );

                return {
                    loading: hasActiveAssistantResponse(nextMessages),
                    messages: nextMessages,
                };
            });
            return;
        }
        case "done": {
            useActivityStore.getState().finish({
                id: event.activityId,
                requestId: event.requestId,
                agentId: event.agentId,
                agentName: event.agentName,
            });
            set((state) => {
                const nextMessages = updateMessage(
                    upsertAssistantMessage(
                        removePendingAssistantMessage(
                            state.messages,
                            event.requestId,
                        ),
                        {
                            id: event.activityId,
                            requestId: event.requestId,
                            agentId: event.agentId,
                            agentName: event.agentName,
                            status: "done",
                        },
                    ),
                    event.activityId,
                    (message) => ({
                        ...message,
                        status: "done",
                    }),
                );

                return {
                    loading: hasActiveAssistantResponse(nextMessages),
                    messages: nextMessages,
                };
            });
            return;
        }
        case "tool": {
            useActivityStore.getState().append({
                id: event.activityId,
                requestId: event.requestId,
                agentId: event.agentId,
                agentName: event.agentName,
            });
            return;
        }
        case "handoff": {
            useActivityStore.getState().append({
                id: event.activityId,
                requestId: event.requestId,
                agentId: event.toAgentId,
                agentName: event.toAgentName,
            });
            return;
        }
        case "error": {
            useActivityStore.getState().fail({
                id: event.activityId,
                requestId: event.requestId,
                agentId: event.agentId,
                agentName: event.agentName,
            });
            set((state) => {
                const nextMessages = updateMessage(
                    upsertAssistantMessage(
                        removePendingAssistantMessage(
                            state.messages,
                            event.requestId,
                        ),
                        {
                            id: event.activityId,
                            requestId: event.requestId,
                            agentId: event.agentId,
                            agentName: event.agentName,
                            status: "error",
                        },
                    ),
                    event.activityId,
                    (message) => ({
                        ...message,
                        content: message.content
                            ? `${message.content}\n\n> ${event.message}`
                            : event.message,
                        status: "error",
                    }),
                );

                return {
                    loading: hasActiveAssistantResponse(nextMessages),
                    messages: nextMessages,
                };
            });
        }
    }
}

export const useChatStore = create<ChatStore>((set, get) => ({
    projects: [DEFAULT_PROJECT],
    currentProjectId: DEFAULT_PROJECT_ID,
    messages: [],
    loading: false,
    chatMode: false,
    setChatMode: (value: boolean) => {
        set({ chatMode: value });
    },
    addProject: () => {
        const nextId = createRandomProjectId();
        set((state) => ({
            projects: [...state.projects, { id: nextId, name: "" }],
            currentProjectId: nextId,
        }));
    },
    setCurrentProject: (projectId: string) => {
        set({ currentProjectId: projectId });
    },
    removeProject: (projectId: string) => {
        if (projectId === DEFAULT_PROJECT_ID) {
            return; // 默认项目不能删除
        }
        set((state) => {
            const newProjects = state.projects.filter(
                (p) => p.id !== projectId,
            );
            let newCurrentProjectId = state.currentProjectId;

            // 如果删除的是当前项目，切换到默认项目
            if (state.currentProjectId === projectId) {
                newCurrentProjectId = DEFAULT_PROJECT_ID;
            }

            return {
                projects: newProjects,
                currentProjectId: newCurrentProjectId,
            };
        });
    },
    send: async ({
        prompt,
        displayContent,
        projectId,
        agentIds = [],
        files,
    }) => {
        const content = prompt.trim();
        const hasFiles = Array.isArray(files) && files.length > 0;
        if ((!content && !hasFiles) || get().loading) {
            return;
        }
        const targetProjectId = projectId ?? get().currentProjectId;

        const requestId = createMessageId();
        const userMessage: ChatMessage = {
            id: createMessageId(),
            role: "user",
            content,
            displayContent: displayContent?.trim() || content || "(文件)",
            status: "done",
            projectId: targetProjectId,
            requestId,
            agentIds,
        };
        await sendRequest({
            prompt: content,
            agentIds,
            files,
            userMessage,
            chatMode: get().chatMode,
            set,
        });
    },
    retry: async (requestId) => {
        if (!requestId || get().loading) {
            return;
        }

        const messages = get().messages;
        const requestStartIndex = messages.findIndex(
            (message) => message.requestId === requestId,
        );
        if (requestStartIndex < 0) {
            return;
        }

        const sourceUserMessage = messages.find(
            (message) =>
                message.requestId === requestId && message.role === "user",
        );
        if (!sourceUserMessage) {
            return;
        }
        const prompt = sourceUserMessage?.content.trim() ?? "";
        if (!prompt) {
            return;
        }

        const nextRequestId = createMessageId();
        const userMessage: ChatMessage = {
            id: sourceUserMessage.id,
            role: "user",
            content: prompt,
            displayContent:
                sourceUserMessage.displayContent ?? sourceUserMessage.content,
            status: "done",
            projectId: sourceUserMessage.projectId,
            requestId: nextRequestId,
            agentIds: sourceUserMessage.agentIds ?? [],
        };
        const optimisticMessages = [
            ...messages.slice(0, requestStartIndex),
            userMessage,
            createPendingAssistantMessage(nextRequestId),
            ...messages
                .slice(requestStartIndex)
                .filter((message) => message.requestId !== requestId),
        ];

        await sendRequest({
            prompt,
            agentIds: sourceUserMessage.agentIds ?? [],
            optimisticMessages,
            userMessage,
            chatMode: get().chatMode,
            set,
        });
    },
    stop: (messageId, requestId) => {
        if (!messageId) {
            return;
        }

        if (messageId !== currentMessageId) {
            return;
        }

        if (requestId && requestId !== currentRequestId) {
            return;
        }

        const targetRequestId = requestId ?? currentRequestId;
        const targetMessageId = messageId ?? currentMessageId;
        currentController?.abort();
        currentController = null;
        currentRequestId = null;
        currentMessageId = null;
        useActivityStore.getState().stopRunning(targetMessageId);

        set((state) => ({
            loading: false,
            messages: stopStreamingMessages(
                state.messages,
                targetMessageId,
                targetRequestId,
            ),
        }));
    },
    setProjectName: (projectId, name) => {
        set((state) => ({
            projects: state.projects.map((project) =>
                project.id === projectId ? { ...project, name } : project,
            ),
        }));
    },
    clearMessages: (projectId) => {
        set((state) => ({
            messages: state.messages.filter(
                (message) => message.projectId !== projectId,
            ),
        }));
    },
}));
