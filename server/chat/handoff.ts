import { tryto } from "@/utils";
import { Agent } from "@openai/agents";
import { z } from "zod";
import {
    getAgentCandidates,
    getAgentsByIds,
    type AgentWithModel,
} from "../agent/store";
import { buildUserPrompt, type ChatUploadFile } from "./prompt";
import { createDefaultAgentConfig, createRunner } from "./provider";
import { extractJsonObject } from "./utils";

export type AgentExecutionPlanItem = {
    agentConfig: AgentWithModel;
    taskPrompt: string;
    reason: string;
    dependsOn?: number[];
};

type ResolveExecutionPlanParams = {
    agentIds: number[];
    prompt: string;
    conversationSummary: string;
    files: ChatUploadFile[];
    uid: string;
};

const MAX_ROUTED_AGENTS = 3;

const handoffPlanSchema = z.object({
    summary: z.string().trim().optional().default(""),
    tasks: z
        .array(
            z.object({
                agentId: z.number().int().positive(),
                task: z.string().trim().min(1),
                reason: z.string().trim().min(1),
                dependsOn: z
                    .array(z.number().int().positive())
                    .optional()
                    .default([]),
            }),
        )
        .max(MAX_ROUTED_AGENTS)
        .default([]),
});

function parseRoutingPlan(text: string) {
    const jsonText = extractJsonObject(text);
    const parsed = jsonText ? JSON.parse(jsonText) : {};
    const result = handoffPlanSchema.safeParse(parsed);

    if (result.success) {
        return result.data;
    }

    return {
        summary: "",
        tasks: [],
    } satisfies z.infer<typeof handoffPlanSchema>;
}

function buildCandidateSummary(candidates: AgentWithModel[]) {
    return candidates
        .map(
            (candidate, index) =>
                `${index + 1}. id=${candidate.id}; 名称=${candidate.name}; 描述=${candidate.desc?.trim() || "无描述"}`,
        )
        .join("\n");
}

function buildRoutingInput(params: {
    prompt: string;
    conversationSummary: string;
    files: ChatUploadFile[];
    candidates: AgentWithModel[];
}) {
    const normalizedPrompt = buildUserPrompt(params.prompt, params.files);
    const fileSummary =
        params.files.length > 0
            ? `用户还上传了 ${params.files.length} 个文件。`
            : "当前没有上传文件。";

    return [
        `用户当前问题：${normalizedPrompt}`,
        fileSummary,
        "",
        "最近对话：",
        params.conversationSummary || "无历史消息",
        "",
        "可选 Agent：",
        buildCandidateSummary(params.candidates),
    ].join("\n");
}

async function createRoutingPlan(params: {
    prompt: string;
    conversationSummary: string;
    files: ChatUploadFile[];
    candidates: AgentWithModel[];
    preSelected?: boolean;
}) {
    const agentConfig = createDefaultAgentConfig();
    const instructions = (
        params.preSelected
            ? [
                  "这些 Agent 已被用户选定。请根据用户问题和各 Agent 的描述，在所有 Agent 之间分配子任务。",
                  "如果子任务之间有依赖关系（一个 Agent 的输出是另一个 Agent 的输入），用 dependsOn 字段表达依赖。没有依赖的任务可以并行执行。",
                  "确保每个 Agent 都至少分配到 1 个子任务，除非其描述与用户问题完全无关。",
                  "task 必须是分配给对应 Agent 的具体执行指令，保留用户问题里的关键上下文，避免过于笼统。",
                  "你必须只返回一个 JSON 对象，不要输出 Markdown、解释或额外文字。",
                  'JSON 结构必须是：{"summary":"", "tasks":[{"agentId":1,"task":"","reason":"","dependsOn":[]}]}。dependsOn 为空表示无依赖可并行。',
              ]
            : [
                  "你负责根据用户问题，在给定候选 Agent 中选择最合适的处理者，并在必要时拆分任务。",
                  "优先只选择 1 个最相关的 Agent。只有当用户问题天然包含多个可以独立执行的子任务时，才拆分给多个 Agent。",
                  "如果子任务之间有依赖关系（一个 Agent 的输出是另一个 Agent 的输入），用 dependsOn 字段表达依赖。没有依赖的任务可以并行执行。",
                  "选择必须严格基于候选 Agent 的描述与用户问题的匹配度。",
                  "task 必须是分配给对应 Agent 的具体执行指令，保留用户问题里的关键上下文，避免过于笼统。",
                  "如果没有较高合适度的 Agent，返回空 tasks。",
                  "你必须只返回一个 JSON 对象，不要输出 Markdown、解释或额外文字。",
                  'JSON 结构必须是：{"summary":"", "tasks":[{"agentId":1,"task":"","reason":"","dependsOn":[]}]}。dependsOn 为空表示无依赖可并行。',
              ]
    ).join("\n");

    const routerAgent = new Agent({
        name: "Agent 路由助手",
        instructions,
        model: agentConfig.model.name,
        modelSettings: {
            temperature: 0,
        },
    });
    const runner = createRunner(agentConfig);

    const result = await runner.run(routerAgent, buildRoutingInput(params));
    const { data: plan } = tryto(() =>
        parseRoutingPlan(String(result.finalOutput ?? "")),
    );

    return (
        plan ?? {
            summary: "",
            tasks: [],
        }
    );
}

function toExecutionPlan(
    candidates: AgentWithModel[],
    plan: z.infer<typeof handoffPlanSchema>,
) {
    const candidateById = new Map(
        candidates.map((candidate) => [candidate.id, candidate]),
    );

    return plan.tasks
        .map((task) => {
            const agentConfig = candidateById.get(task.agentId);
            if (!agentConfig) {
                return null;
            }

            const result: AgentExecutionPlanItem = {
                agentConfig,
                taskPrompt: task.task,
                reason: task.reason,
            };
            if (task.dependsOn && task.dependsOn.length > 0) {
                result.dependsOn = task.dependsOn;
            }
            return result;
        })
        .filter((item): item is AgentExecutionPlanItem => !!item);
}

export async function resolveAgentExecutionPlan(
    params: ResolveExecutionPlanParams,
): Promise<AgentExecutionPlanItem[]> {
    // 1. User explicitly selected agents → route task splitting through LLM
    if (params.agentIds.length > 0) {
        const agents = await getAgentsByIds(params.agentIds, params.uid);
        if (agents.length > 0) {
            const plan = await createRoutingPlan({
                prompt: params.prompt,
                conversationSummary: params.conversationSummary,
                files: params.files,
                candidates: agents,
                preSelected: true,
            });
            const executionPlan = toExecutionPlan(agents, plan);

            // Fill in any agents the router missed with the full prompt
            const assignedIds = new Set(
                executionPlan.map((item) => item.agentConfig.id),
            );
            for (const agent of agents) {
                if (!assignedIds.has(agent.id)) {
                    executionPlan.push({
                        agentConfig: agent,
                        taskPrompt: params.prompt,
                        reason: "用户显式指定了该 Agent。",
                    });
                }
            }

            return executionPlan;
        }
    }

    // 2. No explicit agents → normal routing among all candidates
    const candidates = await getAgentCandidates(params.uid);
    if (candidates.length === 0) {
        return [
            {
                agentConfig: createDefaultAgentConfig(),
                taskPrompt: buildUserPrompt(params.prompt, params.files),
                reason: "数据库中没有可用于路由的 Agent，回退到默认助手。",
            },
        ];
    }

    const plan = await createRoutingPlan({
        prompt: params.prompt,
        conversationSummary: params.conversationSummary,
        files: params.files,
        candidates,
    });
    const executionPlan = toExecutionPlan(candidates, plan);

    if (executionPlan.length > 0) {
        return executionPlan;
    }

    return [
        {
            agentConfig: createDefaultAgentConfig(),
            taskPrompt: buildUserPrompt(params.prompt, params.files),
            reason: "未找到明显合适的数据库 Agent，回退到默认助手。",
        },
    ];
}
