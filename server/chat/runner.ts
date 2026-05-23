import { tryto } from "@/utils";
import { getAgentCandidates } from "../agent/store";
import { buildConversationSummary } from "./conversation";
import {
    runDirectChat,
    executePlan,
    type ChatRunnerPayload,
} from "./executor";
import { resolveAgentExecutionPlan } from "./handoff";
import { FileSession } from "./memories/file-session";
import { type StreamWriter, writeEvent } from "./stream";
import { prepareUploadedFiles } from "./upload";
import { cleanupUploadedFiles } from "./tools/file-reader";
import { createActivityId, toErrorMessage } from "./utils";

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
                        if (payload.chatMode) {
                            await runDirectChat({
                                writer: writer as StreamWriter,
                                encoder,
                                requestId,
                                prompt,
                                files,
                                uid,
                            });
                            return;
                        }

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

                        const outputs = await executePlan({
                            writer: writer as StreamWriter,
                            encoder,
                            requestId,
                            plan: executionPlan,
                            files,
                            candidates,
                            uid,
                        });

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
