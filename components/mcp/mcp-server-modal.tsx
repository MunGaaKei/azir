import request, { useAbort } from "@/server/request";
import { useMcpStore } from "@/stores/mcp";
import { tryto } from "@/utils";
import { Button, Dropdown, Flex, Form, Input, Message } from "@ioca/react";
import { Braces, Cpu } from "lucide-react";
import PubSub from "pubsub-js";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { SettingFooter, SettingModal, SettingPanel, SettingSidebar } from "../modalSetting";
import { MCP_SERVER_PRESETS } from "./constant";
import { parseOAuthConfig } from "./oauth-section";
import type { MCPRecord } from "./types";
import { MCP_MODAL_OPEN_TOPIC, MCP_SERVERS_UPDATED_TOPIC } from "./types";

const required = {
    validator: (value: unknown) => !!value,
    message: "",
};

function formatJson(text: string): string {
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
}

const OAuthInline = memo(function OAuthInline({ configStr, oauthLoading, onAuthorize }: { configStr: string; oauthLoading: boolean; onAuthorize: () => void }) {
    const oi = parseOAuthConfig(configStr);
    if (!oi) return null;
    return (
        <>
            {oi.hasTokens ? <span className="color-5 font-sm">已授权</span> : <span className="error font-sm">未授权</span>}
            <Button size="small" className="bg-blue" loading={oauthLoading} onClick={onAuthorize}>
                {oi.hasTokens ? "重新授权" : "授权"}
            </Button>
        </>
    );
});

export function MCPServerModal() {
    const servers = useMcpStore((state) => state.servers);
    const initServers = useMcpStore((state) => state.initServers);
    const refreshServers = useMcpStore((state) => state.refreshServers);
    const setServers = useMcpStore((state) => state.setServers);
    const form = Form.useForm();
    const [visible, setVisible] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [oauthLoading, setOauthLoading] = useState(false);
    const [configStr, setConfigStr] = useState("");
    const { signal, cancel } = useAbort();

    const handleConfigBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        const formatted = formatJson(e.target.value);
        if (formatted !== e.target.value) {
            form.set({ config: formatted });
        }
        setConfigStr(formatted);
    };

    const handleConfigChange = (v: string) => setConfigStr(v);

    // Listen for OAuth callback postMessage
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === "oauth_success" && event.data?.mcpId) {
                refreshServers();
                Message.success("OAuth 授权完成");
            }
        };
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, [refreshServers]);

    useEffect(() => {
        initServers().catch(() => undefined);

        const token = PubSub.subscribe(MCP_MODAL_OPEN_TOPIC, () => {
            setVisible(true);
        });
        return () => {
            PubSub.unsubscribe(token);
        };
    }, [initServers]);

    const handleSidebarSelect = useCallback((id: number | string) => setEditingId(Number(id)), []);
    const handleSidebarCreate = useCallback(() => setEditingId(null), []);

    const editingServer = useMemo(() => (editingId !== null ? (servers.find((s) => s.id === editingId) ?? null) : null), [editingId, servers]);

    useEffect(() => {
        const config = editingServer ? JSON.stringify(editingServer.config, null, 2) : "";
        form.set({ config });
        setConfigStr(config);
        if (editingServer) {
            form.set({
                name: editingServer.name,
                description: editingServer.description,
            });
        } else {
            form.set({ name: "", description: "" });
        }
    }, [editingServer, form]);

    const handleSave = async () => {
        const values = (await form.validate()) as Record<string, unknown>;
        if (typeof values === "boolean") return;

        const name = String(values.name ?? "").trim();
        if (!name) {
            Message.error("请填写服务名称");
            return;
        }

        let config: Record<string, unknown>;
        try {
            config = JSON.parse(String(values.config ?? "{}"));
            if (typeof config !== "object" || config === null) {
                Message.error("config 必须是一个 JSON 对象");
                return;
            }
        } catch {
            Message.error("config 不是有效的 JSON");
            return;
        }

        const description = String(values.description ?? "").trim();

        setSaving(true);

        const { error, data } = await tryto(
            editingServer
                ? request<MCPRecord>(`/api/mcp/remote/${editingServer.id}`, {
                      method: "PUT",
                      body: { name, description, config },
                      signal: signal(),
                  })
                : request<MCPRecord>("/api/mcp/remote", {
                      method: "POST",
                      body: { name, description, config },
                      signal: signal(),
                  }),
        );

        setSaving(false);

        if (error || !data) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            if (error) Message.error(String(error));
            return;
        }

        refreshServers();
        PubSub.publish(MCP_SERVERS_UPDATED_TOPIC);
        closeModal();
    };

    const handleDelete = async () => {
        if (editingId === null) return;

        const { error } = await tryto(
            request(`/api/mcp/remote/${editingId}`, {
                method: "DELETE",
                signal: signal(),
            }),
        );
        if (error && !(error instanceof DOMException && error.name === "AbortError")) return;

        setServers(servers.filter((s) => s.id !== editingId));
        setEditingId(null);
    };

    const closeModal = useCallback(() => {
        cancel();
        setVisible(false);
        setEditingId(null);
    }, [cancel]);

    const handleOAuthAuthorize = useCallback(async () => {
        const values = (await form.validate()) as Record<string, unknown>;
        if (typeof values === "boolean") return;

        const name = String(values.name ?? "").trim();
        if (!name) {
            Message.error("请填写服务名称");
            return;
        }

        const configStr = form.get("config") as string;
        if (!configStr) {
            Message.error("请填写配置 JSON");
            return;
        }

        let config: Record<string, unknown>;
        try {
            config = JSON.parse(configStr);
        } catch {
            Message.error("配置 JSON 格式错误");
            return;
        }

        if (typeof config.authType !== "string" || config.authType !== "oauth") {
            Message.error('配置 JSON 需要设置 "authType": "oauth"');
            return;
        }

        // Auto-save if the record hasn't been created yet
        let targetId = editingId;
        if (!targetId) {
            const description = String(values.description ?? "").trim();
            setSaving(true);
            const { error, data } = await tryto(
                request<MCPRecord>("/api/mcp/remote", {
                    method: "POST",
                    body: { name, description, config },
                    signal: signal(),
                }),
            );
            setSaving(false);

            if (error || !data) {
                if (error instanceof DOMException && error.name === "AbortError") return;
                if (error) Message.error(String(error));
                return;
            }

            targetId = data.id;
            setEditingId(data.id);
            refreshServers();
        }

        const redirectUri = window.location.origin + "/api/mcp/oauth/callback";

        setOauthLoading(true);

        const { error, data } = await tryto(
            request<{ authorizationUrl: string }>("/api/mcp/oauth/authorize", {
                method: "POST",
                body: { mcpId: targetId, redirectUri },
            }),
        );

        setOauthLoading(false);

        if (error || !data) {
            if (error) Message.error(String(error));
            return;
        }

        const popup = window.open(data.authorizationUrl, "oauth-authorize", "width=600,height=700");
        if (!popup) {
            Message.error("弹出窗口被阻止，请在浏览器中允许弹出窗口");
        }
    }, [editingId, form, signal, refreshServers]);

    const sidebar = useMemo(
        () => <SettingSidebar items={servers} editingId={editingId} onSelect={handleSidebarSelect} onCreate={handleSidebarCreate} renderItem={(s) => s.name} />,
        [servers, editingId, handleSidebarSelect, handleSidebarCreate],
    );

    const configLabel = useMemo(
        () => (
            <Flex align="center" gap={12}>
                <span style={{ flexShrink: 0 }}>配置 Json</span>
                <Dropdown
                    className="ml-auto"
                    width={140}
                    content={(close) =>
                        MCP_SERVER_PRESETS.map((p) => (
                            <Dropdown.Item
                                key={p.label}
                                type="option"
                                onClick={() => {
                                    close();
                                    const json = JSON.stringify(p.config, null, 2);
                                    form.set({
                                        config: json,
                                    });
                                    setConfigStr(json);
                                }}
                            >
                                {p.label}
                            </Dropdown.Item>
                        ))
                    }
                >
                    <Button size="small" secondary className="mr-auto">
                        <Braces size={16} />
                        配置模版
                    </Button>
                </Dropdown>

                <OAuthInline configStr={configStr} oauthLoading={oauthLoading} onAuthorize={handleOAuthAuthorize} />
            </Flex>
        ),
        [configStr, oauthLoading, handleOAuthAuthorize, form],
    );

    return (
        <SettingModal visible={visible} onClose={closeModal} title="MCP 服务管理" icon={Cpu} width={720}>
            {sidebar}
            <SettingPanel>
                <Form form={form} rules={{ name: required, config: required }} labelWidth="3em" labelRight>
                    <Form.Field name="name" required>
                        <Input label="名称" border labelInline placeholder="notion-server" />
                    </Form.Field>

                    <Form.Field name="description">
                        <Input label="描述" border labelInline placeholder="MCP 服务描述" />
                    </Form.Field>

                    <Form.Field name="config" required>
                        <Input.Textarea
                            style={{ ["--label-width" as any]: "100%" }}
                            label={configLabel}
                            border
                            autoSize={false}
                            rows={16}
                            spellCheck={false}
                            resize={false}
                            placeholder='{"serverUrl": "https://..."}'
                            onBlur={handleConfigBlur}
                            onChange={handleConfigChange}
                        />
                    </Form.Field>
                </Form>

                <SettingFooter editing={editingServer !== null} onDelete={handleDelete} onCancel={closeModal} onSubmit={() => void handleSave()} submitting={saving} />
            </SettingPanel>
        </SettingModal>
    );
}
