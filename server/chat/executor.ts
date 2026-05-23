import { tryto } from "@/utils";
import type { AgentWithModel } from "../agent/store";
import type { AgentExecutionPlanItem } from "./handoff";
import { FileSession } from "./memories/file-session";
import { buildUserPrompt, type ChatUploadFile } from "./prompt";
import {
    createAgent,
    createClient,
    createDefaultAgentConfig,
    createRunner,
} from "./provider";
import { type StreamWriter, writeEvent } from "./stream";
import {
    createActivityId,
    extractMessageText,
    toErrorMessage,
    truncate,
} from "./utils";
import { resolveMcpServers } from "./mcp";
import { isMcpAuthError, clearInvalidOAuthTokens } from "../mcp/utils";

export type ChatRunnerPayload = {
    prompt?: string;
    agentIds?: number[];
    requestId?: string;
    files?: ChatUploadFile[];
    chatMode?: boolean;
};

export async function runSingleAgent(params: {
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

    const mcpManager = await resolveMcpServers(params.agentConfig, params.uid, params.requestId);

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
                    streamEvent as unknown as { name: string; item: { rawItem?: { name?: string } } };

                if (payload.name === "tool_called") {
                    const toolName = payload.item?.rawItem?.name || "unknown";
                    await writeEvent(params.writer, params.encoder, {
                        type: "tool",
                        requestId: params.requestId,
                        activityId,
                        agentId: currentAgentId,
                        agentName: currentAgentName,
                        toolName,
                    });
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
    });

    if (mcpManager) {
        await mcpManager.close().catch(() => {});
    }

    if (error) {
        const errorMessage = isMcpAuthError(error)
            ? "[MCP服务]连接失效，请重新认证"
            : toErrorMessage(error);

        if (isMcpAuthError(error)) {
            void clearInvalidOAuthTokens(params.uid);
        }

        await writeEvent(params.writer, params.encoder, {
            type: "error",
            requestId: params.requestId,
            activityId,
            agentId: params.agentConfig.id,
            agentName: params.agentConfig.name,
            message: errorMessage,
        });
        return `[错误] ${errorMessage}`;
    }

    return agentOutput;
}

export async function runDirectChat(params: {
    writer: StreamWriter;
    encoder: TextEncoder;
    requestId: string;
    prompt: string;
    files: ChatUploadFile[];
    uid: string;
}): Promise<string> {
    const agentConfig = createDefaultAgentConfig();
    const client = createClient(agentConfig);
    const activityId = createActivityId();
    const session = new FileSession(params.uid);

    const historyItems = await session.getItems(20);
    const messages: { role: "user" | "assistant"; content: string }[] = [];

    for (const item of historyItems) {
        const cast = item as { role?: string; content?: unknown };
        const extracted = extractMessageText(cast);
        if (extracted && (cast.role === "user" || cast.role === "assistant")) {
            messages.push({
                role: cast.role as "user" | "assistant",
                content: extracted.text,
            });
        }
    }

    const userPrompt = buildUserPrompt(params.prompt, params.files);
    messages.push({ role: "user", content: userPrompt });

    await writeEvent(params.writer, params.encoder, {
        type: "start",
        requestId: params.requestId,
        activityId,
        agentId: 0,
        agentName: "Chat",
    });

    let fullContent = "";

    try {
        const stream = await client.chat.completions.create({
            model: agentConfig.model.name,
            messages,
            stream: true,
        });

        for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
                fullContent += delta;
                await writeEvent(params.writer, params.encoder, {
                    type: "append",
                    requestId: params.requestId,
                    activityId,
                    agentId: 0,
                    agentName: "Chat",
                    content: delta,
                });
            }
        }
    } catch (err) {
        await writeEvent(params.writer, params.encoder, {
            type: "error",
            requestId: params.requestId,
            activityId,
            agentId: 0,
            agentName: "Chat",
            message: toErrorMessage(err),
        });
        return `[错误] ${toErrorMessage(err)}`;
    }

    await writeEvent(params.writer, params.encoder, {
        type: "done",
        requestId: params.requestId,
        activityId,
        agentId: 0,
        agentName: "Chat",
    });

    await session.addItems([
        {
            role: "user",
            content: [{ type: "input_text", text: params.prompt }],
        } as never,
        {
            role: "assistant",
            content: [{ type: "output_text", text: fullContent }],
        } as never,
    ]);

    return fullContent;
}

export async function executePlan(params: {
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
