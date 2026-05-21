import request, { useAbort } from "@/server/request";
import { useAgentsStore } from "@/stores/agents";
import { useMcpStore } from "@/stores/mcp";
import { useModelsStore } from "@/stores/models";
import { tryto } from "@/utils";
import {
    Button,
    Checkbox,
    ColorPicker,
    Editor,
    Flex,
    Form,
    Input,
    Message,
    Popconfirm,
    Popup,
} from "@ioca/react";
import type { Agent } from "@prisma/client";
import { Bot, BotOff, CircleQuestionMark, X } from "lucide-react";
import PubSub from "pubsub-js";
import { useEffect, useState } from "react";
import { MCPSection } from "../mcp/mcp-section";
import { MCPServerModal } from "../mcp/mcp-server-modal";
import { MCP_SERVERS_UPDATED_TOPIC } from "../mcp/types";
import { ModelSelect } from "../model/modal";
import { ScheduleSection } from "../schedule/schedule-section";
import { SkillModal, SkillSelect } from "../skill/modal";
import { SKILLS_UPDATED_TOPIC } from "../skill/utils";
import { BotAnimate } from "../ui/bot-animate";
import AgentActivity from "./activity";
import {
    type AgentPermission,
    type AgentSkill,
    createAgentMentionOptions,
    getAgentFormValues,
    insertAgentMention,
    required,
} from "./form";

type SkillOption = {
    name: string;
    description: string;
};

function buildMeta(
    values: Record<string, unknown>,
    agent: Agent | undefined,
    scheduleEnabled: boolean,
): Record<string, unknown> | undefined {
    const hadSchedule = !!(agent?.meta as Record<string, unknown> | undefined)
        ?.schedule;

    const metaVal = values.meta as Record<string, unknown> | undefined;
    const mcpServers = values.mcp_servers as unknown[] | undefined;

    if (
        !metaVal?.color &&
        !mcpServers?.length &&
        !scheduleEnabled &&
        !hadSchedule
    ) {
        return undefined;
    }

    const meta: Record<string, unknown> = {};
    if (metaVal?.color) meta.color = metaVal.color;
    if (mcpServers?.length) meta.mcp_servers = mcpServers;
    if (scheduleEnabled || hadSchedule) {
        const schedule: Record<string, unknown> = { enabled: scheduleEnabled };
        if (scheduleEnabled) {
            const s = values.schedule as Record<string, unknown> | undefined;
            schedule.time = (s?.time as string) || "09:00";
            schedule.days = Array.isArray(s?.days) ? s.days : [];
            schedule.prompt = ((s?.prompt as string) || "").trim();
        }
        meta.schedule = schedule;
    }
    return meta;
}

function AgentForm({ agent, close }: { agent?: Agent; close?: () => void }) {
    const agents = useAgentsStore((state) => state.agents);
    const setAgents = useAgentsStore((state) => state.setAgents);
    const models = useModelsStore((state) => state.models);
    const mcpServers = useMcpStore((state) => state.servers);
    const initMcpServers = useMcpStore((state) => state.initServers);
    const form = Form.useForm();
    const { signal, cancel } = useAbort();
    const [loading, setLoading] = useState(false);
    const [polishing, setPolishing] = useState(false);
    const [skillOptions, setSkillOptions] = useState<SkillOption[]>([]);
    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const agentMentionOptions = createAgentMentionOptions(agents);

    useEffect(() => {
        const values = getAgentFormValues(agent);
        const meta = agent?.meta as Record<string, unknown> | undefined;
        const s = meta?.schedule as
            | {
                  enabled?: boolean;
                  time?: string;
                  days?: string[];
                  prompt?: string;
              }
            | undefined;

        setScheduleEnabled(s?.enabled ?? false);
        form.set({
            ...values,
            "schedule.time": s?.time ?? "09:00",
            "schedule.days": Array.isArray(s?.days) ? s.days : [],
            "schedule.prompt": s?.prompt ?? "",
        });
    }, [agent, form]);

    useEffect(() => {
        const loadSkills = () => {
            tryto(request<SkillOption[]>("/api/agent/skills"))
                .then(({ data }) => {
                    if (data) setSkillOptions(data);
                })
                .catch(() => undefined);
        };

        loadSkills();
        const token = PubSub.subscribe(SKILLS_UPDATED_TOPIC, loadSkills);
        return () => {
            PubSub.unsubscribe(token);
        };
    }, []);

    useEffect(() => {
        initMcpServers().catch(() => undefined);
        const token = PubSub.subscribe(MCP_SERVERS_UPDATED_TOPIC, () => {
            initMcpServers().catch(() => undefined);
        });
        return () => {
            PubSub.unsubscribe(token);
        };
    }, [initMcpServers]);

    const handleDelete = async () => {
        if (!agent) return;

        const { error } = await tryto(
            request(`/api/agent/${agent.id}`, {
                method: "DELETE",
                signal: signal(),
            }),
        );

        if (error) {
            if (error instanceof DOMException && error.name === "AbortError")
                return;
            return;
        }

        setAgents(agents.filter((a) => a.id !== agent.id));
        close?.();
    };

    const handleSubmit = async () => {
        const values = await form.validate();
        if (typeof values === "boolean") return;

        const modelId = Number(values.model_id);
        if (Number.isNaN(modelId)) {
            form.set({ model_id: values.model_id });
            return;
        }

        setLoading(true);

        const meta = buildMeta(values, agent, scheduleEnabled);

        const { error, data } = await tryto(
            request<Agent>(agent ? `/api/agent/${agent.id}` : "/api/agent", {
                method: agent ? "PUT" : "POST",
                body: {
                    name: values.name,
                    desc: values.desc?.trim() || null,
                    model_id: modelId,
                    skills: Array.isArray(values.skills)
                        ? values.skills.filter(
                              (item): item is AgentSkill =>
                                  typeof item === "string",
                          )
                        : [],
                    permissions: Array.isArray(values.permissions)
                        ? values.permissions.filter(
                              (item): item is AgentPermission =>
                                  item === "websearch" || item === "docs",
                          )
                        : [],
                    routable:
                        Array.isArray(values.routable) &&
                        values.routable.includes("true"),
                    ...(meta ? { meta } : {}),
                },
                signal: signal(),
            }),
        );

        setLoading(false);

        if (error || !data) {
            if (error instanceof DOMException && error.name === "AbortError")
                return;
            throw error;
        }

        Message.info("保存成功 🤞🏼");

        const nextAgents = agent
            ? agents.map((item) => (item.id === data.id ? data : item))
            : [...agents, data].sort((a, b) => a.id - b.id);

        setAgents(nextAgents);
        close?.();
    };

    const handleCancel = () => {
        cancel();
        close?.();
    };

    const handlePolish = async () => {
        const desc = form.get("desc") as string | undefined;
        if (!desc?.trim()) return;

        setPolishing(true);
        try {
            const res = await request<{ content: string }>("/api/chat/prompt", {
                method: "POST",
                body: {
                    prompt: `你是一个 AI Agent 描述优化专家。请将以下描述优化为专业的 Agent 指令，目标是：1）让 Agent 清晰理解自己的职责和执行方式；2）让路由调度系统能准确判断该 Agent 适合处理哪些任务。要求：不超过140个中文字符，或不超过400个英文字符。\n\n${desc}`,
                },
            });
            if (res?.content) {
                form.set({ desc: res.content.trim() });
            }
        } catch {
            Message.error("润色失败");
        } finally {
            setPolishing(false);
        }
    };

    return (
        <Form
            form={form}
            rules={{
                name: required,
                model_id: required,
            }}
            labelInline
            labelWidth="3em"
            labelRight
        >
            <Flex>
                <Form.Field name="name" required>
                    <Input label="名称" border maxLength={16} />
                </Form.Field>

                <Form.Field name="meta.color">
                    <ColorPicker
                        label="颜色"
                        style={{ alignItems: "center", width: 100 }}
                    >
                        {({ value }) => (
                            <span>
                                <BotAnimate fill={value ?? "transparent"} />
                            </span>
                        )}
                    </ColorPicker>
                </Form.Field>
            </Flex>

            <Form.Field name="model_id" required>
                <ModelSelect
                    label="模型"
                    required
                    border
                    options={models.map((model) => ({
                        label: model.name,
                        value: String(model.id),
                    }))}
                />
            </Form.Field>

            <Flex align="center" style={{ marginBottom: -8 }} gap={8}>
                <b
                    className="mr-auto text-right"
                    style={{ width: "var(--label-width)" }}
                >
                    <span className="error" style={{ fontWeight: "normal" }}>
                        *
                    </span>
                    描述
                </b>
                <Button
                    size="small"
                    secondary
                    loading={polishing}
                    onClick={() => void handlePolish()}
                >
                    润色
                </Button>
                <Button
                    size="small"
                    secondary
                    onClick={() => {
                        const desc = form.get("desc") || "";
                        form.set({
                            desc:
                                desc +
                                (desc ? "\n\n" : "") +
                                "\n```azir-file\nfilename: example.pdf\nbase64: <base64>\n```",
                        });
                    }}
                >
                    添加文件下载按钮
                </Button>
            </Flex>

            <Form.Field name="desc">
                <Editor
                    border
                    height="8em"
                    autosize
                    hideControl
                    mode="plaintextOnMemtion"
                    spellCheck={false}
                    placeholder="尽可能描述TA应该在什么时候，做什么事情"
                    memtion={[
                        {
                            key: "@",
                            options: agentMentionOptions,
                            insert: insertAgentMention,
                        },
                    ]}
                />
            </Form.Field>

            <Form.Field name="skills">
                <SkillSelect
                    multiple
                    label="技能"
                    border
                    maxDisplay={2}
                    options={skillOptions.map((skill) => ({
                        label: skill.name,
                        value: skill.name,
                        desc: skill.description,
                    }))}
                />
            </Form.Field>

            <SkillModal />

            <Form.Field name="mcp_servers">
                <MCPSection
                    multiple
                    label="MCP"
                    border
                    maxDisplay={2}
                    options={mcpServers.map((s) => ({
                        label: s.name,
                        value: s.name,
                    }))}
                />
            </Form.Field>

            <MCPServerModal />

            <Form.Field name="permissions">
                <Checkbox
                    type="switch"
                    label="权限"
                    options={[
                        { label: "联网搜索", value: "websearch" },
                        { label: "读写文件", value: "docs" },
                    ]}
                />
            </Form.Field>

            <ScheduleSection
                enabled={scheduleEnabled}
                onToggle={setScheduleEnabled}
            />

            <Form.Field name="routable">
                <Checkbox
                    label={
                        <Flex gap={2} align="center">
                            <Popup
                                className="pd-12"
                                content={
                                    <div
                                        style={{ maxWidth: 200, fontSize: 14 }}
                                    >
                                        开启后，调度算法会优先选择参与调度的
                                        Agent
                                        来处理用户消息，除非它们明确表示无法处理。
                                    </div>
                                }
                            >
                                <CircleQuestionMark size={12} />
                            </Popup>
                            调度
                        </Flex>
                    }
                    type="switch"
                    options={[{ label: "参与调度", value: "true" }]}
                />
            </Form.Field>

            <Flex justify="end" className="mt-8" gap={8}>
                {agent && (
                    <Popconfirm
                        icon={null}
                        content="确定删除"
                        okButtonProps={{ className: "bg-error" }}
                        onOk={handleDelete}
                    >
                        <Button secondary className="mr-auto error">
                            <BotOff size={20} /> 删除
                        </Button>
                    </Popconfirm>
                )}
                {close && (
                    <Button flat onClick={handleCancel}>
                        取消
                    </Button>
                )}
                <Button loading={loading} onClick={() => void handleSubmit()}>
                    {agent ? "保存" : "创建"}
                </Button>
            </Flex>
        </Form>
    );
}

export function AgentModal({
    agent,
    close,
}: {
    agent: Agent;
    close: () => void;
}) {
    const [tab, setTab] = useState<string | undefined>("信息");

    return (
        <>
            <div className="flex items-center gap-8 px-12 py-8">
                <Bot size={32} />
                <b>{agent.name}</b>

                <Button
                    flat
                    square
                    size="small"
                    className="ml-auto"
                    onClick={close}
                >
                    <X size={20} />
                </Button>
            </div>

            <div className="pd-16">
                {tab === "信息" && <AgentForm agent={agent} close={close} />}
                {tab === "活动" && <AgentActivity agentId={agent.id} />}
            </div>
        </>
    );
}

export function AgentCreate({ close }: { close: () => void }) {
    return (
        <div className="pd-16 flex flex-column gap-12">
            <h5 className="text-center flex items-center justify-center gap-4">
                <Bot /> 新建
            </h5>

            <AgentForm close={close} />
        </div>
    );
}
