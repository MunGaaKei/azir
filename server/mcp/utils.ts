import {
    MCPServerStreamableHttp,
    MCPServerSSE,
    createMCPToolStaticFilter,
} from "@openai/agents";
import type { MCPServer } from "@openai/agents";
import type { MCPServerConfig } from "../../components/mcp/types";
import { AzirOAuthClientProvider } from "./oauth";

function readString(
    config: Record<string, unknown>,
    ...keys: string[]
): string | undefined {
    for (const key of keys) {
        const val = config[key];
        if (typeof val === "string" && val.trim()) return val.trim();
    }
    return undefined;
}

function readStringArray(
    config: Record<string, unknown>,
    key: string,
): string[] | undefined {
    const val = config[key];
    if (Array.isArray(val)) return val.filter((v): v is string => typeof v === "string");
    return undefined;
}

function readRecord(
    config: Record<string, unknown>,
    key: string,
): Record<string, string> | undefined {
    const val = config[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
        const result: Record<string, string> = {};
        for (const [k, v] of Object.entries(val)) {
            if (typeof v === "string") result[k] = v;
        }
        return Object.keys(result).length > 0 ? result : undefined;
    }
    return undefined;
}

import { db } from "../db";

const MCP_AUTH_ERROR_PATTERNS = [
    /401/,
    /403/,
    /unauthorized/i,
    /token.*(?:expir|invalid|refres)/i,
    /oauth.*(?:expir|invalid|fail)/i,
    /authorization.*(?:required|failed|expir)/i,
];

/**
 * 检测错误是否由 MCP 远程连接认证过期引起
 */
export function isMcpAuthError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return MCP_AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * 清除指定用户所有 MCP 服务的过期 OAuth tokens（从数据库中）
 * 确保 UI 能正确显示 "未授权" 状态
 */
export async function clearInvalidOAuthTokens(uid: string): Promise<void> {
    try {
        const records = await (db as any).mcp.findMany({
            where: { uid },
        }) as Array<{ id: number; config: unknown }>;

        for (const record of records) {
            const config = (record.config ?? {}) as Record<string, unknown>;
            if (config.authType !== "oauth") continue;

            const oauth = { ...((config.oauth as Record<string, unknown>) || {}) };
            if (!oauth.tokens) continue;

            delete oauth.tokens;
            config.oauth = oauth;

            await (db as any).mcp.update({
                where: { id: record.id },
                data: { config },
            });
        }
    } catch {
        // best-effort cleanup
    }
}

export function createMcpServerInstance(
    cfg: MCPServerConfig,
    options?: { includeToolFilter?: boolean; uid?: string },
): MCPServer {
    const config = cfg.config;
    const url = readString(config, "serverUrl", "url");
    if (!url) throw new Error(`MCP server "${cfg.name}": 缺少 serverUrl`);

    const transport = readString(config, "transport") ?? "streamable-http";
    if (transport !== "streamable-http" && transport !== "sse") {
        throw new Error(
            `MCP server "${cfg.name}": transport 必须是 streamable-http 或 sse`,
        );
    }

    const allowedTools = readStringArray(config, "allowedTools");

    const toolFilter =
        options?.includeToolFilter !== false
            ? createMCPToolStaticFilter({
                  allowed: allowedTools,
              })
            : undefined;

    // Check for OAuth auth type
    const authType = readString(config, "authType");
    let authProvider: AzirOAuthClientProvider | undefined;
    if (authType === "oauth" && options?.uid && cfg.id !== undefined) {
        authProvider = new AzirOAuthClientProvider(
            config,
            Number(cfg.id),
            options.uid,
        );
    }

    if (authProvider) {
        // OAuth flow: authProvider handles auth, no requestInit needed
        if (transport === "sse") {
            return new MCPServerSSE({
                name: cfg.name,
                url,
                toolFilter,
                authProvider,
            });
        }

        return new MCPServerStreamableHttp({
            name: cfg.name,
            url,
            toolFilter,
            authProvider,
        });
    }

    // Bearer token flow
    const authorization = readString(config, "authorization");
    const headers = readRecord(config, "headers");

    const mergedHeaders: Record<string, string> = { ...headers };
    if (authorization) {
        mergedHeaders["Authorization"] = authorization.startsWith("Bearer ")
            ? authorization
            : `Bearer ${authorization}`;
    }

    const requestInit =
        Object.keys(mergedHeaders).length > 0
            ? { headers: mergedHeaders }
            : undefined;

    if (transport === "sse") {
        return new MCPServerSSE({
            name: cfg.name,
            url,
            toolFilter,
            requestInit,
        });
    }

    return new MCPServerStreamableHttp({
        name: cfg.name,
        url,
        toolFilter,
        requestInit,
    });
}
