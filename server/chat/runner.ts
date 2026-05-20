import { tryto } from "@/utils";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ChatStreamEvent } from "../../stores/type";
import { getAgentCandidates, type AgentWithModel } from "../agent/store";
import {
    resolveAgentExecutionPlan,
    type AgentExecutionPlanItem,
} from "./handoff";
import { log } from "./logger";
import { FileSession } from "./memories/file-session";
import { buildUserPrompt, type ChatUploadFile } from "./prompt";
import { createAgent, createRunner } from "./provider";
import { resolveMcpServers } from "./utils";
import {
    cleanupUploadedFiles,
    setUploadedFiles,
    type UploadedFileInfo,
} from "./tools/file-reader";
import {
    createActivityId,
    extractMessageText,
    sanitizeFilename,
    toErrorMessage,
    truncate,
} from "./utils";

export type ChatRunnerPayload = {
    prompt?: string;
    agentIds?: number[];
    requestId?: string;
    files?: ChatUploadFile[];
};

type StreamWriter = WritableStreamDefaultWriter<Uint8Array>;

type RunItemStreamEventPayload = {
    name: string;
    item: {
        agent?: {
            name: string;
        };
        rawItem?: {
            name?: string;
            content?: Array<{
                type: "output_text";
                text: string;
            }>;
        };
    };
};

function encodeSseEvent(event: ChatStreamEvent) {
    return `data: ${JSON.stringify(event)}\n\n`;
}

async function writeEvent(
    writer: StreamWriter,
    encoder: TextEncoder,
    event: ChatStreamEvent,
) {
    await writer.write(encoder.encode(encodeSseEvent(event)));
}

async function prepareUploadedFiles(
    requestId: string,
    files: ChatUploadFile[],
) {
    if (files.length === 0) {
        setUploadedFiles(requestId, []);
        return;
    }

    const dir = await mkdtemp(path.join(tmpdir(), `azir-${requestId}-`));
    const uploadedFiles = await Promise.all(
        files.map(async (file, index) => {
            const filename = sanitizeFilename(file.name, index);
            const filepath = path.join(dir, `${index}-${filename}`);
            const buffer = Buffer.from(file.base64, "base64");

            await writeFile(filepath, buffer);

            return {
                filename,
                filepath,
                type: file.type || "application/octet-stream",
                size: buffer.byteLength,
            } satisfies UploadedFileInfo;
        }),
    );

    setUploadedFiles(requestId, uploadedFiles);
}

async function runSingleAgent(params: {
    writer: StreamWriter;
    encoder: TextEncoder;
    requestId: string;
    agentConfig: AgentWithModel;
    taskPrompt: string;
    files: ChatUploadFile[];
    candidates: AgentWithModel[];
    uid: string;
}): Promise<string> {
    let activityId = createActivityId();

    // Resolve and connect MCP servers
    const mcpManager = await resolveMcpServers(params.agentConfig, params.uid);

    const agent = await createAgent(
        params.agentConfig,
        { requestId: params.requestId },
        params.candidates,
        0,
        mcpManager?.active ?? [],
    );
    const runner = createRunner(params.agentConfig);

    await writeEvent(params.writer, params.encoder, {
        type: "start",
        requestId: params.requestId,
        activityId,
        agentId: params.agentConfig.id,
        agentName: params.agentConfig.name,
    });

    void log(
        params.requestId,
        `Agent "${params.agentConfig.name}" (id=${params.agentConfig.id}) 开始运行，技能: ${(params.agentConfig.skills as string[] | null)?.join(", ") || "无"}`,
    );

    // Each agent uses its own isolated session
    const session = new FileSession(
        params.uid,
        `agent_${params.agentConfig.id}`,
    );
    let agentOutput = "";

    const { error } = await tryto(async () => {
        const result = await runner.run(
            agent,
            buildUserPrompt(params.taskPrompt, params.files),
            {
                stream: true,
                session,
            },
        );
        let currentAgentId = params.agentConfig.id;
        let currentAgentName = params.agentConfig.name;

        for await (const streamEvent of result.toStream()) {
            if (streamEvent.type === "agent_updated_stream_event") {
                const nextAgentName = streamEvent.agent.name;
                if (nextAgentName !== currentAgentName) {
                    const nextAgentConfig =
                        params.candidates.find(
                            (candidate) => candidate.name === nextAgentName,
                        ) || params.agentConfig;
                    await writeEvent(params.writer, params.encoder, {
                        type: "handoff",
                        requestId: params.requestId,
                        activityId,
                        fromAgentId: currentAgentId,
                        fromAgentName: currentAgentName,
                        toAgentId: nextAgentConfig.id,
                        toAgentName: nextAgentConfig.name,
                    });
                    await writeEvent(params.writer, params.encoder, {
                        type: "done",
                        requestId: params.requestId,
                        activityId,
                        agentId: currentAgentId,
                        agentName: currentAgentName,
                    });
                    currentAgentId = nextAgentConfig.id;
                    currentAgentName = nextAgentConfig.name;
                    activityId = createActivityId();
                    await writeEvent(params.writer, params.encoder, {
                        type: "start",
                        requestId: params.requestId,
                        activityId,
                        agentId: nextAgentConfig.id,
                        agentName: nextAgentConfig.name,
                    });
                }
            }

            if (streamEvent.type === "run_item_stream_event") {
                const payload =
                    streamEvent as unknown as RunItemStreamEventPayload;

                if (payload.name === "tool_called") {
                    const toolName = payload.item?.rawItem?.name || "unknown";
                    void log(
                        params.requestId,
                        `Agent "${currentAgentName}" (id=${currentAgentId}) 调用工具 "${toolName}"`,
                    );
                    await writeEvent(params.writer, params.encoder, {
                        type: "tool",
                        requestId: params.requestId,
                        activityId,
                        agentId: currentAgentId,
                        agentName: currentAgentName,
                        toolName,
                    });
                    continue;
                }

                continue;
            }

            if (streamEvent.type === "raw_model_stream_event") {
                const eventType = String(streamEvent.data.type);
                const delta = (streamEvent.data as { delta?: string }).delta;
                if (!delta) {
                    continue;
                }

                if (
                    eventType === "output_text_delta" ||
                    eventType === "response.output_text.delta"
                ) {
                    agentOutput += delta;
                    await writeEvent(params.writer, params.encoder, {
                        type: "append",
                        requestId: params.requestId,
                        activityId,
                        agentId: currentAgentId,
                        agentName: currentAgentName,
                        content: delta,
                    });
                    continue;
                }
            }
        }

        await result.completed;
        if (result.error) {
            throw result.error;
        }

        await writeEvent(params.writer, params.encoder, {
            type: "done",
            requestId: params.requestId,
            activityId,
            agentId: currentAgentId,
            agentName: currentAgentName,
        });

        void log(
            params.requestId,
            `Agent "${currentAgentName}" (id=${currentAgentId}) 运行完成`,
        );
    });

    // Clean up MCP servers regardless of result
    if (mcpManager) {
        await mcpManager.close().catch(() => {});
    }

    if (error) {
        void log(
            params.requestId,
            `Agent "${params.agentConfig.name}" (id=${params.agentConfig.id}) 运行出错: ${toErrorMessage(error)}`,
        );
        await writeEvent(params.writer, params.encoder, {
            type: "error",
            requestId: params.requestId,
            activityId,
            agentId: params.agentConfig.id,
            agentName: params.agentConfig.name,
            message: toErrorMessage(error),
        });
        return `[错误] ${toErrorMessage(error)}`;
    }

    return agentOutput;
}

async function executePlan(params: {
    writer: StreamWriter;
    encoder: TextEncoder;
    requestId: string;
    plan: AgentExecutionPlanItem[];
    files: ChatUploadFile[];
    candidates: AgentWithModel[];
    uid: string;
}) {
    const outputs = new Map<number, string>();
    const completed = new Set<number>();
    let remaining = [...params.plan];

    while (remaining.length > 0) {
        const ready = remaining.filter(
            (item) =>
                !item.dependsOn ||
                item.dependsOn.every((id) => completed.has(id)),
        );

        if (ready.length === 0) {
            remaining.forEach((item) => completed.add(item.agentConfig.id));
            break;
        }

        remaining = remaining.filter((item) => !ready.includes(item));

        // Inject dependency outputs into task prompts
        for (const item of ready) {
            if (item.dependsOn && item.dependsOn.length > 0) {
                const depTexts: string[] = [];
                for (const depId of item.dependsOn) {
                    const depOutput = outputs.get(depId);
                    if (depOutput) {
                        const depAgent = params.plan.find(
                            (p) => p.agentConfig.id === depId,
                        );
                        depTexts.push(
                            `[${depAgent?.agentConfig.name || `Agent ${depId}`} 的输出]:\n${depOutput}`,
                        );
                    }
                }
                if (depTexts.length > 0) {
                    item.taskPrompt = [
                        item.taskPrompt,
                        "",
                        "---",
                        "以下是依赖 Agent 的输出结果，请基于这些结果继续处理：",
                        ...depTexts,
                    ].join("\n");
                }
            }
        }

        const results = await Promise.allSettled(
            ready.map((item) =>
                runSingleAgent({
                    writer: params.writer,
                    encoder: params.encoder,
                    requestId: params.requestId,
                    agentConfig: item.agentConfig,
                    taskPrompt: item.taskPrompt,
                    files: params.files,
                    candidates: params.candidates,
                    uid: params.uid,
                }),
            ),
        );

        for (let i = 0; i < ready.length; i++) {
            const result = results[i];
            const output = result.status === "fulfilled" ? result.value : "";
            outputs.set(ready[i].agentConfig.id, output);
            completed.add(ready[i].agentConfig.id);
        }
    }

    return outputs;
}

const SUMMARY_MAX_ITEMS = 8;
const SUMMARY_MAX_LENGTH = 2000;
const SUMMARY_MAX_CHARS_PER_MESSAGE = 400;

async function buildConversationSummary(session: FileSession): Promise<string> {
    const items = await session.getItems(SUMMARY_MAX_ITEMS);
    const parts: string[] = [];
    let total = 0;

    for (const item of items) {
        const extracted = extractMessageText(
            item as { role?: string; content?: unknown },
        );
        if (!extracted) continue;

        const truncated = truncate(
            extracted.text,
            SUMMARY_MAX_CHARS_PER_MESSAGE,
        );
        const line = extracted.prefix + truncated;
        total += line.length;

        if (total > SUMMARY_MAX_LENGTH && parts.length > 0) {
            break;
        }
        parts.push(line);
    }

    return parts.join("\n");
}

export async function createChatResponse(
    payload: ChatRunnerPayload,
    uid: string,
) {
    const prompt = String(payload.prompt ?? "");
    const requestId =
        typeof payload.requestId === "string" && payload.requestId.trim()
            ? payload.requestId
            : createActivityId();
    const agentIds = Array.isArray(payload.agentIds)
        ? payload.agentIds.filter((id): id is number => Number.isFinite(id))
        : [];
    const files = Array.isArray(payload.files) ? payload.files : [];
    const encoder = new TextEncoder();

    let controllerClosed = false;

    return new Response(
        new ReadableStream({
            cancel() {
                controllerClosed = true;
            },
            start(controller) {
                const safeWrite = (chunk: Uint8Array) => {
                    if (controllerClosed) return Promise.resolve();
                    try {
                        controller.enqueue(chunk);
                    } catch {
                        controllerClosed = true;
                    }
                    return Promise.resolve();
                };

                const writer = {
                    write: safeWrite,
                } satisfies Pick<StreamWriter, "write">;

                void (async () => {
                    const { error } = await tryto(async () => {
                        const globalSession = new FileSession(uid);
                        await prepareUploadedFiles(requestId, files);
                        const candidates = await getAgentCandidates(uid);
                        const conversationSummary =
                            await buildConversationSummary(globalSession);
                        const executionPlan = await resolveAgentExecutionPlan({
                            agentIds,
                            prompt,
                            conversationSummary,
                            files,
                            uid,
                        });

                        // Execute all agents with per-agent session isolation
                        const outputs = await executePlan({
                            writer: writer as StreamWriter,
                            encoder,
                            requestId,
                            plan: executionPlan,
                            files,
                            candidates,
                            uid,
                        });

                        // Save agent outputs to global session for future routing context
                        const assistantItems: never[] = [];
                        for (const item of executionPlan) {
                            const output = outputs.get(item.agentConfig.id);
                            if (output && !output.startsWith("[错误]")) {
                                assistantItems.push({
                                    role: "assistant" as const,
                                    content: [
                                        {
                                            type: "output_text" as const,
                                            text: `[${item.agentConfig.name}]: ${output}`,
                                        },
                                    ],
                                } as never);
                            }
                        }
                        await globalSession.addItems([
                            {
                                role: "user",
                                content: [{ type: "input_text", text: prompt }],
                            } as never,
                            ...assistantItems,
                        ]);
                    });

                    if (error) {
                        await writeEvent(writer as StreamWriter, encoder, {
                            type: "error",
                            requestId,
                            activityId: createActivityId(),
                            agentId: 0,
                            agentName: "默认助手",
                            message: toErrorMessage(error),
                        });
                    }

                    await cleanupUploadedFiles(requestId);
                    if (!controllerClosed) {
                        controllerClosed = true;
                        controller.close();
                    }
                })();
            },
        }),
        {
            headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
            },
        },
    );
}
