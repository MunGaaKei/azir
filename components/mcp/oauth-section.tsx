import { Button, Flex } from "@ioca/react";

export function parseOAuthConfig(configStr: string) {
    if (!configStr) return null;

    try {
        const config = JSON.parse(configStr);
        if (config.authType !== "oauth") return null;

        const oauth: Record<string, unknown> = config.oauth ?? {};
        const tokens = oauth.tokens as Record<string, unknown> | undefined;
        const hasTokens = !!tokens?.access_token;
        const tokenExpiry =
            typeof tokens?.expires_in === "number"
                ? `${Math.round(tokens.expires_in / 60)} 分钟`
                : null;

        return { hasTokens, tokenExpiry };
    } catch {
        return null;
    }
}

export function OAuthSection({
    configStr,
    oauthLoading,
    onAuthorize,
}: {
    configStr: string;
    oauthLoading: boolean;
    onAuthorize: () => Promise<void>;
}) {
    const info = parseOAuthConfig(configStr);
    if (!info) return null;

    return (
        <Flex justify="between" align="center" className="my-12">
            <b className="mr-12">OAuth 授权</b>

            {info.hasTokens ? (
                <span className="brown">{info.tokenExpiry}过期</span>
            ) : (
                <span className="error">未授权</span>
            )}

            <Button
                size="small"
                className="ml-12"
                loading={oauthLoading}
                onClick={onAuthorize}
            >
                {info.hasTokens ? "重新授权" : "授权"}
            </Button>
        </Flex>
    );
}
