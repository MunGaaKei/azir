import { randomUUID } from "node:crypto";
import path from "node:path";

export function createActivityId() {
    return randomUUID();
}

export function toErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "请求处理失败";
}

export function sanitizeFilename(filename: string, index: number) {
    const base = path.basename(filename || `file-${index}`);
    return base || `file-${index}`;
}

export function truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + "… (省略)";
}

export type ExtractedMessage = { prefix: string; text: string };

export function extractMessageText(
    raw: { role?: string; content?: unknown },
): ExtractedMessage | null {
    if (raw.role === "user") {
        const text =
            typeof raw.content === "string"
                ? raw.content
                : Array.isArray(raw.content)
                  ? raw.content
                        .filter(
                            (c: { type?: string; text?: string }) =>
                                c.type === "input_text",
                        )
                        .map((c: { text?: string }) => c.text)
                        .join(" ")
                  : "";
        return text ? { prefix: "用户: ", text: text.trim() } : null;
    }
    if (raw.role === "assistant") {
        const text = Array.isArray(raw.content)
            ? raw.content
                  .filter(
                      (c: { type?: string; text?: string }) =>
                          c.type === "output_text",
                  )
                  .map((c: { text?: string }) => c.text)
                  .join("")
            : "";
        return text ? { prefix: "助手: ", text: text.trim() } : null;
    }
    return null;
}

import { MCPServers } from "@openai/agents";
import type { AgentWithModel } from "../agent/store";
import { getMcpServerConfigs } from "../mcp/index";
import { createMcpServerInstance } from "../mcp/utils";
import { log } from "./logger";

export type McpManager = Awaited<ReturnType<typeof MCPServers.open>> | null;

export async function resolveMcpServers(
    agentConfig: AgentWithModel,
    uid: string,
    requestId?: string,
): Promise<McpManager> {
    const meta = agentConfig.meta as Record<string, unknown> | undefined;
    const mcpNames: string[] = Array.isArray(meta?.mcp_servers)
        ? (meta.mcp_servers as string[]).filter(
              (s): s is string => typeof s === "string",
          )
        : [];
    const mcpConfigs = await getMcpServerConfigs(mcpNames, uid);
    const mcpServers = mcpConfigs.map((config) =>
        createMcpServerInstance(config, { uid }),
    );

    if (mcpServers.length === 0) return null;

    const manager = await MCPServers.open(mcpServers, {
        dropFailed: true,
        connectInParallel: true,
    });

    // Log failed MCP connections for debugging
    if (manager.errors.size > 0 && requestId) {
        for (const [server, err] of manager.errors) {
            log(
                requestId,
                `MCP 服务器 "${server.name}" 连接失败: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    return manager;
}

export function extractJsonObject(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
        return "";
    }

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch?.[1]) {
        return fencedMatch[1].trim();
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
        return trimmed.slice(start, end + 1);
    }

    return trimmed;
}
