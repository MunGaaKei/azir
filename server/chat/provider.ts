// 这个文件利用@openai/agents生成 agent
// 参考 https://openai.github.io/openai-agents-js/zh/guides/config/

import { tryto } from "@/utils";
import { resolveMentionPayload } from "@/utils/mention";
import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import OpenAI from "openai";
import type { AgentWithModel } from "../agent/store";
import { createAgentSkillTools } from "../skills";
import { currentTimeTool } from "./tools/current-time";
import {
    buildFileContextPrompt,
    createReadUploadedFileTool,
    getUploadedFiles,
} from "./tools/file-reader";
import { tavilyWebSearchTool } from "./tools/web-search";

export type AgentProviderOptions = {
    requestId?: string;
    additionalInstructions?: string;
};

type AgentPermission = "websearch" | "file_reader";

function getStringArray(value: unknown) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(
        (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
    );
}

function getAgentPermissions(value: unknown): Set<AgentPermission> {
    return new Set(
        getStringArray(value).filter(
            (item): item is AgentPermission => item === "websearch",
        ),
    );
}

function buildInstructions(
    agentConfig: AgentWithModel,
    options: AgentProviderOptions,
) {
    const uploadedFiles = options.requestId
        ? getUploadedFiles(options.requestId)
        : [];
    const instructions = [
        `你是 AI Agent "${agentConfig.name}"。`,
        agentConfig.desc?.trim() ||
            "请根据用户需求提供准确、清晰、可执行的帮助。",
        "你的最终回答只能包含用户可见的结论和结果，不允许在正文中出现任何内部推理内容。",
        buildFileContextPrompt(uploadedFiles),
        options.additionalInstructions?.trim() || "",
    ]
        .map((item) => item.trim())
        .filter(Boolean);

    return instructions.join("\n\n");
}

/**
 * 禁用 DeepSeek thinking 模式，避免产生 reasoning_content 字段。
 * DeepSeek 要求在后续请求中原样回传 reasoning_content，
 * 但 @openai/agents SDK 无法正确处理该字段。
 * 通过设置 thinking: { type: "disabled" } 从源头杜绝。
 */
function shouldDisableDeepSeekThinking(requestUrl: string, init?: RequestInit) {
    const { data: url, error } = tryto(() => new URL(requestUrl));
    if (error || !url) {
        return false;
    }

    return (
        url.hostname === "api.deepseek.com" &&
        url.pathname.endsWith("/chat/completions") &&
        String(init?.method ?? "POST").toUpperCase() === "POST"
    );
}

function withDeepSeekThinkingDisabled(body: BodyInit | null | undefined) {
    if (typeof body !== "string") {
        return body;
    }

    const { data: parsed, error } = tryto(
        () => JSON.parse(body) as Record<string, unknown>,
    );
    if (
        error ||
        !parsed ||
        typeof parsed !== "object" ||
        "thinking" in parsed
    ) {
        return body;
    }

    return JSON.stringify({
        ...parsed,
        thinking: {
            type: "disabled",
        },
    });
}

function createClient(agentConfig: AgentWithModel) {
    const originalFetch = globalThis.fetch;

    return new OpenAI({
        apiKey: agentConfig.model.apiKey,
        baseURL: agentConfig.model.apiUrl,
        fetch: async (url, init) => {
            let modifiedInit = init;
            if (shouldDisableDeepSeekThinking(String(url), init)) {
                modifiedInit = {
                    ...init,
                    body: withDeepSeekThinkingDisabled(init?.body),
                };
            }
            return originalFetch(url, modifiedInit);
        },
    });
}

function shouldUseResponsesAPI() {
    return false;
}

function createModelProvider(agentConfig: AgentWithModel) {
    return new OpenAIProvider({
        openAIClient: createClient(agentConfig),
        useResponses: shouldUseResponsesAPI(),
    });
}

async function resolveTools(
    agentConfig: AgentWithModel,
    options: AgentProviderOptions,
) {
    const skillNames = Array.from(new Set(getStringArray(agentConfig.skills)));
    const permissions = getAgentPermissions(agentConfig.permissions);
    const tools = [currentTimeTool];

    if (permissions.has("websearch")) {
        tools.push(tavilyWebSearchTool);
    }

    if (options.requestId && getUploadedFiles(options.requestId).length > 0) {
        tools.push(createReadUploadedFileTool(options.requestId));
    }

    const skillTools = await createAgentSkillTools(skillNames, agentConfig.uid, options.requestId);
    tools.push(...skillTools);

    return tools;
}

export function createRunner(agentConfig: AgentWithModel) {
    return new Runner({
        modelProvider: createModelProvider(agentConfig),
        tracingDisabled: true,
        traceIncludeSensitiveData: false,
    });
}

export function createDefaultAgentConfig(): AgentWithModel {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const apiUrl = process.env.OPENAI_API_URL?.trim();
    const modelName = process.env.OPENAI_MODEL?.trim();

    if (!apiKey || !apiUrl || !modelName) {
        throw new Error(
            "默认模型配置缺失，请检查 OPENAI_API_KEY、OPENAI_API_URL、OPENAI_MODEL",
        );
    }

    return {
        id: 0,
        name: "默认助手",
        desc: "请使用默认模型配置，简洁、准确地回答用户问题。",
        model_id: 0,
        skills: [],
        permissions: [],
        routable: true,
        meta: {},
        uid: "",
        createdAt: new Date(0),
        model: {
            id: 0,
            name: modelName,
            apiUrl: apiUrl,
            apiKey: apiKey,
            uid: "",
            createdAt: new Date(0),
        },
    } as AgentWithModel;
}

export async function createAgent(
    agentConfig: AgentWithModel,
    options: AgentProviderOptions = {},
    candidates?: AgentWithModel[],
    depth = 0,
) {
    const handoffAgents: Agent[] = [];
    if (depth === 0 && candidates) {
        const mentionOptions = candidates.map((c) => ({
            label: c.name,
            value: c.id,
        }));
        const { agentIds } = resolveMentionPayload(
            agentConfig.desc || "",
            mentionOptions,
        );
        const handoffConfigs = candidates.filter((c) =>
            agentIds.includes(c.id),
        );
        for (const config of handoffConfigs) {
            const agent = await createAgent(
                config,
                options,
                candidates,
                depth + 1,
            );
            handoffAgents.push(agent);
        }
    }

    return new Agent({
        name: agentConfig.name,
        instructions: buildInstructions(agentConfig, options),
        model: agentConfig.model.name,
        tools: await resolveTools(agentConfig, options),
        handoffs: handoffAgents,
    });
}
