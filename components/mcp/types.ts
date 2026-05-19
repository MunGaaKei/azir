export const MCP_MODAL_OPEN_TOPIC = "mcp-modal:open";
export const MCP_SERVERS_UPDATED_TOPIC = "mcp-servers:updated";
export const MCP_OAUTH_COMPLETED_TOPIC = "mcp-oauth:completed";

export type MCPServerConfig = {
    id?: number;
    name: string;
    config: Record<string, unknown>;
};

export type MCPRecord = {
    id: number;
    name: string;
    description: string;
    config: Record<string, unknown>;
    createdAt: string;
};
