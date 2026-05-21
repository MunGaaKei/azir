import { Hono } from "hono";
import { db } from "../db";
import { tryto } from "../../utils";
import { getUid } from "../uid";
import { createMcpServerInstance, isMcpAuthError } from "./utils";
import type { MCPServerConfig } from "../../components/mcp/types";

const api = new Hono();

// ---- Cache ----
type CachedServer = MCPServerConfig & { id: number };
const mcpCache = new Map<string, Promise<Map<string, CachedServer>>>();

async function loadMcpServers(uid: string) {
    const servers = new Map<string, CachedServer>();

    try {
        const records = await (db as any).mcp.findMany({
            where: { uid },
        }) as Array<{ id: number; name: string; config: unknown }>;

        for (const r of records) {
            servers.set(r.name, {
                id: r.id,
                name: r.name,
                config: (r.config ?? {}) as Record<string, unknown>,
            });
        }
    } catch {
        // DB might not be available
    }

    return servers;
}

function getMcpServersMap(uid: string) {
    if (!mcpCache.has(uid)) {
        mcpCache.set(uid, loadMcpServers(uid));
    }
    return mcpCache.get(uid)!;
}

export function invalidateMcpCache(uid: string) {
    mcpCache.delete(uid);
}

export async function listAvailableMcpServers(uid: string) {
    const servers = await getMcpServersMap(uid);
    return Array.from(servers.values()).map((s) => ({
        id: s.id,
        name: s.name,
        config: s.config,
    }));
}

export async function getMcpServerConfigs(
    mcpNames: string[],
    uid: string,
): Promise<MCPServerConfig[]> {
    if (!mcpNames.length) return [];

    const servers = await getMcpServersMap(uid);
    return mcpNames
        .map((name) => servers.get(name))
        .filter((s): s is CachedServer => !!s)
        .map((s) => ({ id: s.id, name: s.name, config: s.config }));
}

// ---- List tools endpoint (used by UI to preview tools) ----
api.post("/list-tools", async (c) => {
    const body = (await c.req.json()) as {
        name?: string;
        config?: Record<string, unknown>;
    };
    const uid = getUid(c);

    if (!body.config || typeof body.config !== "object") {
        return c.json({ message: "缺少 config" }, 400);
    }

    const { error, data: tools } = await tryto(async () => {
        const server = createMcpServerInstance(
            {
                name: body.name?.trim() || "temp-listing",
                config: body.config as Record<string, unknown>,
            },
            { includeToolFilter: false, uid },
        );

        await server.connect();
        const mcpTools = await server.listTools();
        await server.close();

        return mcpTools.map((t) => ({
            name: t.name,
            description: t.description ?? "",
        }));
    });

    if (error) {
        const message = isMcpAuthError(error)
            ? "[MCP服务]连接失效，请重新认证"
            : String(error);
        return c.json({ message }, 400);
    }

    return c.json({ tools });
});

export default api;
