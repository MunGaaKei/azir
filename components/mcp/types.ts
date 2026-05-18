export const MCP_MODAL_OPEN_TOPIC = "mcp-modal:open";
export const MCP_SERVERS_UPDATED_TOPIC = "mcp-servers:updated";

export type MCPServerConfig = {
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
