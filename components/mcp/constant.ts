export interface MCPServerPreset {
    label: string;
    config: Record<string, unknown>;
}

export const MCP_SERVER_PRESETS: MCPServerPreset[] = [
    {
        label: "Notion OAuth",
        config: {
            serverUrl: "https://mcp.notion.com/sse",
            transport: "sse",
            authType: "oauth",
            oauth: {
                redirectUri: "https://sandsoldier.vercel.app/api/mcp/oauth/callback",
            },
            allowedTools: ["*"],
        },
    },
    {
        label: "Jira OAuth",
        config: {
            serverUrl: "https://mcp.atlassian.com/v1/mcp/authv2",
            authType: "oauth",
            oauth: {
                redirectUri: "https://sandsoldier.vercel.app/api/mcp/oauth/callback",
            },
        },
    },
    {
        label: "API Token",
        config: {
            serverUrl: "https://mcp.example.com/sse",
            transport: "sse",
            authorization: "Bearer ${YOUR_API_TOKEN}",
            allowedTools: ["*"],
        },
    },
    {
        label: "Stdio",
        config: {
            transport: "stdio",
            command: "npx",
            args: ["-y", "mcp-server-package-name"],
            env: {
                API_KEY: "your-api-key",
            },
            allowedTools: ["*"],
        },
    },
];
