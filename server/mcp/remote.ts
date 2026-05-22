import { Hono } from "hono";
import { db } from "../db";
import { getUid } from "../uid";
import { invalidateMcpCache } from "./index";
import { AzirOAuthClientProvider, getPendingAuth, deletePendingAuth } from "./oauth";

const api = new Hono();

api.post("/remote", async (c) => {
    const uid = getUid(c);
    const body = (await c.req.json().catch(() => ({}))) as Record<
        string,
        unknown
    >;

    const name = String(body.name ?? "").trim();
    if (!name) {
        return c.json({ message: "name 不能为空" }, 400);
    }

    const existing = await (db as any).mcp.findFirst({
        where: { uid, name },
    });
    if (existing) {
        return c.json({ message: "同名 MCP 服务已存在" }, 409);
    }

    const config =
        body.config && typeof body.config === "object"
            ? body.config
            : {};
    const description = String(body.description ?? "").trim();

    const record = await (db as any).mcp.create({
        data: {
            uid,
            name,
            description,
            config: JSON.parse(JSON.stringify(config)),
        },
    });

    invalidateMcpCache(uid);

    return c.json({
        id: record.id,
        name: record.name,
        description: record.description,
        config: record.config,
    });
});

api.put("/remote/:id", async (c) => {
    const uid = getUid(c);
    const recordId = Number(c.req.param("id"));

    if (Number.isNaN(recordId)) {
        return c.json({ message: "无效的 ID" }, 400);
    }

    const body = (await c.req.json().catch(() => ({}))) as Record<
        string,
        unknown
    >;

    const existing = await (db as any).mcp.findFirst({
        where: { id: recordId, uid },
    });
    if (!existing) {
        return c.json({ message: "未找到该 MCP 服务" }, 404);
    }

    const data: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) {
        const name = body.name.trim();
        // Check name uniqueness excluding current record
        const conflict = await (db as any).mcp.findFirst({
            where: { uid, name, id: { not: recordId } },
        });
        if (conflict) {
            return c.json({ message: "同名 MCP 服务已存在" }, 409);
        }
        data.name = name;
    }
    if (typeof body.description === "string") {
        data.description = body.description.trim();
    }
    if (body.config && typeof body.config === "object") {
        data.config = JSON.parse(JSON.stringify(body.config));
    }

    const record = await (db as any).mcp.update({ where: { id: recordId }, data });

    invalidateMcpCache(uid);

    return c.json({
        id: record.id,
        name: record.name,
        description: record.description,
        config: record.config,
    });
});

api.get("/remote", async (c) => {
    const uid = getUid(c);
    const records = await (db as any).mcp.findMany({
        where: { uid },
        orderBy: { id: "asc" },
        select: {
            id: true,
            name: true,
            description: true,
            config: true,
            createdAt: true,
        },
    });

    return c.json(records);
});

api.get("/remote/:id", async (c) => {
    const uid = getUid(c);
    const id = Number(c.req.param("id"));

    if (Number.isNaN(id)) {
        return c.json({ message: "无效的 ID" }, 400);
    }

    const record = await (db as any).mcp.findFirst({
        where: { id, uid },
    });
    if (!record) {
        return c.json({ message: "未找到该 MCP 服务" }, 404);
    }

    return c.json(record);
});

api.delete("/remote/:id", async (c) => {
    const uid = getUid(c);
    const id = Number(c.req.param("id"));

    if (Number.isNaN(id)) {
        return c.json({ message: "无效的 ID" }, 400);
    }

    const record = await (db as any).mcp.findFirst({
        where: { id, uid },
    });
    if (!record) {
        return c.json({ message: "未找到该 MCP 服务" }, 404);
    }

    await (db as any).mcp.delete({ where: { id } });
    invalidateMcpCache(uid);

    return c.json({ message: "已删除" });
});

// ---- OAuth endpoints ----

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

export type OAuthAuthorizeRequest = {
    mcpId: number;
    redirectUri?: string;
};

/**
 * POST /api/mcp/oauth/authorize
 *
 * Initiates the OAuth authorization flow for a saved MCP server.
 * Returns the authorization URL that the user should open in their browser.
 */
api.post("/oauth/authorize", async (c) => {
    const uid = getUid(c);
    const body = (await c.req.json().catch(() => ({}))) as OAuthAuthorizeRequest;
    const mcpId = Number(body.mcpId);

    if (!Number.isFinite(mcpId)) {
        return c.json({ message: "缺少 mcpId" }, 400);
    }

    const record = await (db as any).mcp.findFirst({
        where: { id: mcpId, uid },
    });
    if (!record) {
        return c.json({ message: "未找到该 MCP 服务" }, 404);
    }

    const config = (record.config ?? {}) as Record<string, unknown>;
    const serverUrl = readString(config, "serverUrl", "url");
    if (!serverUrl) {
        return c.json({ message: "MCP 配置缺少 serverUrl" }, 400);
    }

    // Override redirectUri if provided
    if (body.redirectUri) {
        const oauth = { ...((config.oauth as Record<string, unknown>) || {}) };
        oauth.redirectUri = body.redirectUri;
        config.oauth = oauth;
    }

    const provider = new AzirOAuthClientProvider(config, record.id, uid);
    const redirectUrl = provider.redirectUrl;
    if (!redirectUrl) {
        return c.json({ message: "OAuth 配置缺少 redirectUri" }, 400);
    }

    try {
        const {
            discoverOAuthServerInfo,
            registerClient,
            startAuthorization,
        } = await import(
            "@modelcontextprotocol/sdk/client/auth.js"
        );

        // 1. Discover OAuth server metadata
        const { authorizationServerUrl, authorizationServerMetadata } =
            await discoverOAuthServerInfo(serverUrl);

        // 2. DCR if needed
        let clientInfo = await provider.clientInformation();
        if (!clientInfo) {
            clientInfo = await registerClient(authorizationServerUrl, {
                metadata: authorizationServerMetadata,
                clientMetadata: provider.clientMetadata,
            });
            await provider.saveClientInformation(clientInfo);
        }

        // 3. Generate authorization URL with PKCE
        const state = await provider.state();
        const { authorizationUrl, codeVerifier } =
            await startAuthorization(authorizationServerUrl, {
                metadata: authorizationServerMetadata,
                clientInformation: clientInfo,
                redirectUrl: String(redirectUrl),
                state,
            });

        await provider.saveCodeVerifier(codeVerifier);

        return c.json({
            authorizationUrl: authorizationUrl.toString(),
        });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : String(error);
        return c.json({ message: `OAuth 授权失败: ${message}` }, 400);
    }
});

/**
 * GET /api/mcp/oauth/callback?code=xxx&state=yyy
 *
 * Handles the OAuth redirect callback from the authorization server.
 * Exchanges the authorization code for tokens and saves them to the DB.
 */
api.get("/oauth/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");

    if (!code || !state) {
        return c.html(
            "<html><body><p>缺少 code 或 state 参数</p></body></html>",
        );
    }

    const pending = getPendingAuth(state);
    if (!pending) {
        return c.html(
            "<html><body><p>授权状态无效或已过期，请重新授权</p></body></html>",
        );
    }

    try {
        const record = await (db as any).mcp.findFirst({
            where: { id: pending.serverId, uid: pending.uid },
        });
        if (!record) {
            return c.html(
                "<html><body><p>未找到 MCP 服务记录</p></body></html>",
            );
        }

        const config = (record.config ?? {}) as Record<string, unknown>;
        const serverUrl = readString(config, "serverUrl", "url");
        if (!serverUrl) {
            return c.html(
                "<html><body><p>MCP 配置缺少 serverUrl</p></body></html>",
            );
        }

        const provider = new AzirOAuthClientProvider(
            config,
            record.id,
            pending.uid,
        );

        const {
            discoverOAuthServerInfo,
            exchangeAuthorization,
        } = await import(
            "@modelcontextprotocol/sdk/client/auth.js"
        );

        const { authorizationServerUrl, authorizationServerMetadata } =
            await discoverOAuthServerInfo(serverUrl);

        const clientInfo = await provider.clientInformation();
        if (!clientInfo) {
            return c.html(
                "<html><body><p>未找到 OAuth 客户端信息，请重新授权</p></body></html>",
            );
        }

        const tokens = await exchangeAuthorization(
            authorizationServerUrl,
            {
                metadata: authorizationServerMetadata,
                clientInformation: clientInfo,
                authorizationCode: code,
                codeVerifier: pending.codeVerifier,
                redirectUri: pending.redirectUri,
            },
        );

        await provider.saveTokens(tokens);
        invalidateMcpCache(pending.uid);

        return c.html(`<!DOCTYPE html>
<html>
<body>
    <script>
        if (window.opener) {
            window.opener.postMessage({ type: "oauth_success", mcpId: ${pending.serverId} }, "*");
        }
        window.close();
    </script>
    <p>OAuth 授权完成，窗口即将关闭</p>
</body>
</html>`);
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : String(error);
        return c.html(
            `<!DOCTYPE html>
<html>
<body>
    <p>OAuth 授权失败: ${message}</p>
    <p>请关闭此窗口后重试</p>
</body>
</html>`,
        );
    } finally {
        deletePendingAuth(state);
    }
});

export default api;
