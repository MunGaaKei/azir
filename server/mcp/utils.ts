import {
    MCPServerStreamableHttp,
    MCPServerSSE,
    createMCPToolStaticFilter,
} from "@openai/agents";
import type { MCPServer } from "@openai/agents";
import type { MCPServerConfig } from "../../components/mcp/types";

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

export function createMcpServerInstance(
    cfg: MCPServerConfig,
    options?: { includeToolFilter?: boolean },
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

    const authorization = readString(config, "authorization");
    const headers = readRecord(config, "headers");
    const allowedTools = readStringArray(config, "allowedTools");

    // Merge authorization into headers (add Bearer prefix if missing)
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

    const toolFilter =
        options?.includeToolFilter !== false
            ? createMCPToolStaticFilter({
                  allowed: allowedTools,
              })
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
