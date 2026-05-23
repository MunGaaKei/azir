import { MCPServers } from "@openai/agents";
import type { AgentWithModel } from "../agent/store";
import { getMcpServerConfigs } from "../mcp/index";
import { createMcpServerInstance } from "../mcp/utils";

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

    if (manager.errors.size > 0 && requestId) {
        for (const [server, err] of manager.errors) {
            console.error(
                `MCP 服务器 "${server.name}" 连接失败: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    return manager;
}
