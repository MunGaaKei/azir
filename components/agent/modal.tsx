import request from "@/server/request";
import { useAgentsStore } from "@/stores/agents";
import { useModelsStore } from "@/stores/models";
import { tryto } from "@/utils";
import { Button, Editor, Flex, Form, Input, Modal, Radio } from "@ioca/react";
import type { Agent } from "@prisma/client";
import { Bot } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const required = {
    validator: (value: unknown) => !!value,
    message: "",
};

type AgentFormValues = {
    name: string;
    desc?: string;
    model_id: string;
};

function AgentModalForm({
    agent,
    close,
}: {
    agent?: Agent;
    close: () => void;
}) {
    const agents = useAgentsStore((state) => state.agents);
    const setAgents = useAgentsStore((state) => state.setAgents);
    const models = useModelsStore((state) => state.models);
    const form = Form.useForm();
    const [loading, setLoading] = useState(false);
    const title = useMemo(
        () =>
            agent ? (
                <>
                    <span className="color-5">编辑</span> {agent.name}
                </>
            ) : (
                "新建"
            ),
        [agent],
    );

    useEffect(() => {
        form.set({
            name: agent?.name ?? "",
            desc: agent?.desc ?? "",
            model_id: agent ? String(agent.model_id) : "",
        });
    }, [agent, form]);

    const handleSubmit = async () => {
        const values = await form.validate();

        if (typeof values === "boolean") {
            return;
        }

        const modelId = Number(values.model_id);

        if (Number.isNaN(modelId)) {
            form.set({
                model_id: values.model_id,
            });
            return;
        }

        setLoading(true);

        const { error, data } = await tryto(
            request<Agent>(agent ? `/api/agent/${agent.id}` : "/api/agent", {
                method: agent ? "PUT" : "POST",
                body: {
                    name: values.name,
                    desc: values.desc?.trim() || null,
                    model_id: modelId,
                },
            }),
        );

        setLoading(false);

        if (error || !data) {
            throw error;
        }

        const nextAgents = agent
            ? agents.map((item) => (item.id === data.id ? data : item))
            : [...agents, data].sort((a, b) => a.id - b.id);

        setAgents(nextAgents);
        close();
    };

    return (
        <div className="pd-16 flex flex-column gap-12">
            <h5 className="text-center flex items-center justify-center gap-4">
                <Bot /> {title}
            </h5>

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
                <Form.Field name="name" required>
                    <Input label="名称" border />
                </Form.Field>

                <Form.Field name="model_id" required>
                    <Radio
                        label="模型"
                        type="button"
                        required
                        style={{ gap: ".5em" }}
                        options={models.map((model) => ({
                            label: model.name,
                            value: String(model.id),
                        }))}
                    />
                </Form.Field>

                <Form.Field name="desc">
                    <Editor
                        border
                        height="8em"
                        autosize
                        hideControl
                        mode="plaintextOnMemtion"
                        placeholder="尽可能描述TA应该在什么时候，做什么事情"
                        memtion={{
                            options: agents.map((agent) => ({
                                label: agent.name,
                                value: String(agent.id),
                            })),
                            insert: (option) => {
                                return "@" + option.label;
                            },
                        }}
                    />
                </Form.Field>

                <Flex justify="end" className="mt-8">
                    <Button flat onClick={close}>
                        取消
                    </Button>
                    <Button
                        loading={loading}
                        onClick={() => void handleSubmit()}
                    >
                        {agent ? "保存" : "创建"}
                    </Button>
                </Flex>
            </Form>
        </div>
    );
}

export function useAgentModal() {
    const modal = Modal.useModal();

    const open = (agent?: Agent) => {
        modal.open({
            customized: true,
            width: 360,
            backdropClosable: false,
            children: <AgentModalForm agent={agent} close={modal.close} />,
        });
    };

    return {
        openCreate: () => open(),
        openEdit: (agent: Agent) => open(agent),
    };
}
