import { db } from "../db";
import type {
    OAuthClientInformationMixed,
    OAuthTokens,
    OAuthClientMetadata,
} from "@modelcontextprotocol/sdk/shared/auth.js";

// ---- Pending OAuth state (server-side, keyed by state parameter) ----

export type PendingAuth = {
    serverId: number;
    uid: string;
    serverUrl: string;
    redirectUri: string;
    codeVerifier: string;
};

const pendingAuths = new Map<string, PendingAuth>();

export function getPendingAuth(state: string): PendingAuth | undefined {
    return pendingAuths.get(state);
}

export function deletePendingAuth(state: string) {
    pendingAuths.delete(state);
}

// ---- AzirOAuthClientProvider ----

/**
 * Implements the MCP SDK's OAuthClientProvider interface for the Azir system.
 *
 * Tokens and client information are persisted in the MCP record's config JSON blob.
 * PKCE code verifiers are stored in-memory in the pendingAuths map keyed by state.
 *
 * This provider is generic and works with any OAuth 2.1 capable MCP server.
 */
export class AzirOAuthClientProvider {
    private config: Record<string, unknown>;
    private serverId: number;
    private uid: string;
    private _authorizationUrl: URL | null = null;
    private currentState: string | null = null;
    private _cachedTokens: OAuthTokens | null = null;
    private _cachedClientInfo: OAuthClientInformationMixed | null = null;
    private _cachedDiscoveryState: Record<string, unknown> | null = null;

    constructor(config: Record<string, unknown>, serverId: number, uid: string) {
        this.config = config;
        this.serverId = serverId;
        this.uid = uid;
    }

    /** The URL to redirect the user agent to after authorization. */
    get redirectUrl(): string | URL | undefined {
        const oauth = this.config.oauth as
            | Record<string, unknown>
            | undefined;
        if (oauth?.redirectUri && typeof oauth.redirectUri === "string") {
            return oauth.redirectUri;
        }
        return undefined;
    }

    /** Returns the authorization URL captured during the flow. */
    get authorizationUrl(): URL | null {
        return this._authorizationUrl;
    }

    /** Metadata about this OAuth client. */
    get clientMetadata(): OAuthClientMetadata {
        const redirectUrl = this.redirectUrl;
        return {
            redirect_uris: [redirectUrl ? String(redirectUrl) : ""].filter(
                Boolean,
            ) as [string, ...string[]],
            token_endpoint_auth_method: "none",
            client_name: "Azir",
        };
    }

    /** Loads existing OAuth client information. */
    async clientInformation(): Promise<
        OAuthClientInformationMixed | undefined
    > {
        if (this._cachedClientInfo) return this._cachedClientInfo;

        const oauth = this.config.oauth as
            | Record<string, unknown>
            | undefined;
        if (oauth?.clientInfo) {
            this._cachedClientInfo =
                oauth.clientInfo as OAuthClientInformationMixed;
            return this._cachedClientInfo;
        }
        return undefined;
    }

    /** Saves OAuth client information after DCR. */
    async saveClientInformation(
        info: OAuthClientInformationMixed,
    ): Promise<void> {
        this._cachedClientInfo = info;
        await this.updateOauthConfig({ clientInfo: info });
    }

    /** Loads existing OAuth tokens. */
    async tokens(): Promise<OAuthTokens | undefined> {
        if (this._cachedTokens) return this._cachedTokens;

        const oauth = this.config.oauth as
            | Record<string, unknown>
            | undefined;
        if (oauth?.tokens) {
            this._cachedTokens = oauth.tokens as OAuthTokens;
            return this._cachedTokens;
        }
        return undefined;
    }

    /** Stores new OAuth tokens. Preserves existing refresh_token if not returned. */
    async saveTokens(tokens: OAuthTokens): Promise<void> {
        const merged = { ...tokens };
        if (!merged.refresh_token && this._cachedTokens?.refresh_token) {
            merged.refresh_token = this._cachedTokens.refresh_token;
        }
        this._cachedTokens = merged;
        await this.updateOauthConfig({ tokens: merged });
    }

    /** Invoked to redirect the user agent to the authorization URL. */
    async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
        this._authorizationUrl = authorizationUrl;
    }

    /** Saves a PKCE code verifier. */
    async saveCodeVerifier(codeVerifier: string): Promise<void> {
        if (this.currentState) {
            const existing = pendingAuths.get(this.currentState);
            if (existing) {
                pendingAuths.set(this.currentState, {
                    ...existing,
                    codeVerifier,
                });
            }
        }
    }

    /** Loads the PKCE code verifier. */
    async codeVerifier(): Promise<string> {
        if (this.currentState) {
            const auth = pendingAuths.get(this.currentState);
            if (auth?.codeVerifier) return auth.codeVerifier;
        }
        throw new Error("没有找到 PKCE code verifier，请重新授权");
    }

    /** Generates a cryptographic state parameter. */
    async state(): Promise<string> {
        const state = crypto.randomUUID();
        this.currentState = state;
        const oauth = this.config.oauth as
            | Record<string, unknown>
            | undefined;
        pendingAuths.set(state, {
            serverId: this.serverId,
            uid: this.uid,
            serverUrl: this.config.serverUrl as string,
            redirectUri: (oauth?.redirectUri as string) || "",
            codeVerifier: "",
        });
        return state;
    }

    /** Invalidates credentials on auth errors. */
    async invalidateCredentials(
        scope: "all" | "client" | "tokens" | "verifier" | "discovery",
    ): Promise<void> {
        if (scope === "all" || scope === "tokens") {
            this._cachedTokens = null;
        }
        if (scope === "all" || scope === "client") {
            this._cachedClientInfo = null;
        }
        if (scope === "all" || scope === "verifier") {
            this.currentState = null;
        }
        if (scope === "all" || scope === "discovery") {
            this._cachedDiscoveryState = null;
        }
    }

    /** Saves OAuth discovery state for caching. */
    async saveDiscoveryState(state: Record<string, unknown>): Promise<void> {
        this._cachedDiscoveryState = state;
    }

    /** Returns cached discovery state. */
    async discoveryState(): Promise<Record<string, unknown> | undefined> {
        return this._cachedDiscoveryState ?? undefined;
    }

    // ---- Internal helpers ----

    private async updateOauthConfig(
        updates: Record<string, unknown>,
    ): Promise<void> {
        try {
            const record = await (db as any).mcp.findFirst({
                where: { id: this.serverId, uid: this.uid },
            });
            if (!record) return;

            const currentConfig = {
                ...((record.config as Record<string, unknown>) || {}),
            };
            const currentOauth = {
                ...((currentConfig.oauth as Record<string, unknown>) || {}),
            };

            Object.assign(currentOauth, updates);

            // Preserve config fields outside oauth
            const mergedConfig = {
                ...currentConfig,
                oauth: currentOauth,
            };

            await (db as any).mcp.update({
                where: { id: this.serverId },
                data: { config: mergedConfig },
            });
        } catch (e) {
            // Best-effort persistence
        }
    }
}
