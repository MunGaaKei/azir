import request from "@/server/request";
import { useMcpStore } from "@/stores/mcp";
import { tryto } from "@/utils";
import {
    Button,
    Flex,
    Form,
    Input,
    List,
    Message,
    Modal,
    Popconfirm,
} from "@ioca/react";
import { Inbox, Plus, Trash2 } from "lucide-react";
import PubSub from "pubsub-js";
import { useEffect, useState } from "react";
import css from "./index.module.css";
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

export function MCPServerModal() {
    const servers = useMcpStore((state) => state.servers);
    const initServers = useMcpStore((state) => state.initServers);
    const refreshServers = useMcpStore((state) => state.refreshServers);
    const setServers = useMcpStore((state) => state.setServers);
    const form = Form.useForm();
    const [visible, setVisible] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        initServers().catch(() => undefined);

        const token = PubSub.subscribe(MCP_MODAL_OPEN_TOPIC, () => {
            setVisible(true);
        });
        return () => {
            PubSub.unsubscribe(token);
        };
    }, [initServers]);

    const editingServer =
        editingId !== null
            ? (servers.find((s) => s.id === editingId) ?? null)
            : null;

    useEffect(() => {
        if (editingServer) {
            form.set({
                name: editingServer.name,
                description: editingServer.description,
                config: JSON.stringify(editingServer.config, null, 2),
            });
        } else {
            form.set({
                name: "",
                description: "",
                config: JSON.stringify(
                    {
                        serverUrl: "",
                        transport: "streamable-http",
                    },
                    null,
                    2,
                ),
            });
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
                  })
                : request<MCPRecord>("/api/mcp/remote", {
                      method: "POST",
                      body: { name, description, config },
                  }),
        );

        setSaving(false);

        if (error || !data) {
            if (error) Message.error(String(error));
            return;
        }

        refreshServers();
        PubSub.publish(MCP_SERVERS_UPDATED_TOPIC);
        closeModal();
    };

    const handleDelete = async (id: number) => {
        const { error } = await tryto(
            request(`/api/mcp/remote/${id}`, { method: "DELETE" }),
        );
        if (!error) {
            setServers(servers.filter((s) => s.id !== id));
            if (editingId === id) setEditingId(null);
        }
    };

    const closeModal = () => {
        setVisible(false);
        setEditingId(null);
    };

    return (
        <Modal
            customized
            visible={visible}
            width={640}
            backdropClosable={false}
            onClose={closeModal}
        >
            <div className={css.header}>
                <b className="mr-auto">MCP 服务管理</b>
            </div>

            <Flex>
                <ul className={css.list}>
                    {servers.map((s) => (
                        <List.Item
                            key={s.id}
                            type="option"
                            className={css.item}
                            active={editingId === s.id}
                            onClick={() => setEditingId(s.id)}
                        >
                            {s.name}
                        </List.Item>
                    ))}

                    {!servers.length && (
                        <div className="flex py-20 justify-center">
                            <Inbox color="var(--color-5)" />
                        </div>
                    )}

                    <Button
                        secondary
                        size="small"
                        className="mx-auto my-12"
                        onClick={() => setEditingId(null)}
                    >
                        <Plus size={16} /> 创建
                    </Button>
                </ul>

                <div className="flex-1 pd-12" style={{ minWidth: 0 }}>
                    <Form
                        form={form}
                        rules={{ name: required, config: required }}
                        labelInline
                        labelRight
                        labelWidth="5em"
                    >
                        <Form.Field name="name" required>
                            <Input
                                label="名称"
                                border
                                placeholder="notion-server"
                            />
                        </Form.Field>

                        <Form.Field name="description">
                            <Input
                                label="描述"
                                border
                                placeholder="MCP 服务描述"
                            />
                        </Form.Field>

                        <Form.Field name="config" required>
                            <Input.Textarea
                                label="配置 JSON"
                                border
                                rows={12}
                                resize={false}
                                autoSize
                                spellCheck={false}
                                placeholder={JSON.stringify(
                                    {
                                        serverUrl: "https://mcp.example.com",
                                        transport: "streamable-http",
                                        authorization: "Bearer sk-...",
                                        headers: { "X-Custom": "value" },
                                        allowedTools: ["search"],
                                    },
                                    null,
                                    2,
                                )}
                                onBlur={(
                                    e: React.FocusEvent<HTMLTextAreaElement>,
                                ) => {
                                    const formatted = formatJson(
                                        e.target.value,
                                    );
                                    if (formatted !== e.target.value) {
                                        form.set({ config: formatted });
                                    }
                                }}
                            />
                        </Form.Field>
                    </Form>

                    <Flex justify="end" className="mt-8" gap={8}>
                        {editingServer && (
                            <Popconfirm
                                icon={null}
                                content="确定删除"
                                okButtonProps={{ className: "bg-error" }}
                                onOk={() => handleDelete(editingServer.id)}
                            >
                                <Button secondary className="mr-auto error">
                                    <Trash2 size={14} /> 删除
                                </Button>
                            </Popconfirm>
                        )}
                        <Button flat onClick={closeModal}>
                            取消
                        </Button>
                        <Button
                            loading={saving}
                            onClick={() => void handleSave()}
                        >
                            {editingServer ? "更新" : "创建"}
                        </Button>
                    </Flex>
                </div>
            </Flex>
        </Modal>
    );
}
