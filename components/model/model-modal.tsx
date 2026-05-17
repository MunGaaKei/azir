import request from "@/server/request";
import { useModelsStore } from "@/stores/models";
import { tryto } from "@/utils";
import {
    Button,
    Flex,
    Form,
    Input,
    List,
    Modal,
    Popconfirm,
} from "@ioca/react";
import type { Model } from "@prisma/client";
import { Inbox, Plus } from "lucide-react";
import PubSub from "pubsub-js";
import { useEffect, useState } from "react";
import css from "./index.module.css";
import { getModelFormValues, MODEL_MODAL_OPEN_TOPIC, required } from "./utils";

export function ModelModal() {
    const models = useModelsStore((state) => state.models);
    const initModels = useModelsStore((state) => state.initModels);
    const setModels = useModelsStore((state) => state.setModels);
    const form = Form.useForm();
    const [visible, setVisible] = useState(false);
    const [id, setId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        initModels().catch(() => undefined);

        const token = PubSub.subscribe(
            MODEL_MODAL_OPEN_TOPIC,
            (_, model?: Model) => {
                if (model) {
                    setId(String(model.id));
                    form.set(getModelFormValues(model));
                } else {
                    setId(null);
                    form.clear();
                }

                setVisible(true);
            },
        );

        return () => {
            PubSub.unsubscribe(token);
        };
    }, [form, initModels]);

    const closeModal = () => {
        setVisible(false);
        setId(null);
        form.clear();
    };

    const handleDelete = async () => {
        if (!id) return;

        const { error } = await tryto(
            request(`/api/model/${id}`, { method: "DELETE" }),
        );

        if (error) return;

        setModels(models.filter((m) => String(m.id) !== id));
        closeModal();
    };

    const handleSubmit = async () => {
        const values = await form.validate();

        if (typeof values === "boolean") {
            return;
        }

        setLoading(true);

        const { error, data } = await tryto(
            request<Model>(id ? `/api/model/${id}` : "/api/model", {
                method: id ? "PUT" : "POST",
                body: values,
            }),
        );

        setLoading(false);

        if (error || !data) {
            throw error;
        }

        const nextModels = id
            ? models.map((model) => (model.id === data.id ? data : model))
            : [...models, data].sort((a, b) => a.id - b.id);

        setModels(nextModels);
        closeModal();
    };

    return (
        <Modal
            customized
            visible={visible}
            width={600}
            backdropClosable={false}
            onClose={closeModal}
        >
            <div className={css.header}>
                <b className="mr-auto">模型管理</b>
            </div>

            <Flex>
                <ul className={css.list}>
                    {models.map((model) => (
                        <List.Item
                            key={model.id}
                            type="option"
                            className={css.item}
                            onClick={() => {
                                setId(String(model.id));
                                form.set(getModelFormValues(model));
                            }}
                        >
                            {model.name}
                        </List.Item>
                    ))}

                    {!models.length ? (
                        <div className="flex py-20 justify-center">
                            <Inbox color="var(--color-5)" />
                        </div>
                    ) : null}

                    <Button
                        secondary
                        size="small"
                        className="mx-auto my-12"
                        onClick={() => {
                            form.clear();
                            setId(null);
                        }}
                    >
                        <Plus size={16} /> 创建
                    </Button>
                </ul>

                <Form
                    form={form}
                    className="flex-1 pd-12"
                    labelInline
                    labelWidth="5em"
                    labelRight
                    rules={{
                        name: required,
                        apiUrl: required,
                        apiKey: required,
                    }}
                >
                    <Form.Field name="name" required>
                        <Input label="名称" border placeholder="gpt-4o" />
                    </Form.Field>
                    <Form.Field name="apiUrl" required>
                        <Input label="API Url" border placeholder="https://api.openai.com/v1" />
                    </Form.Field>
                    <Form.Field name="apiKey" required>
                        <Input label="API Key" border type="password" placeholder="sk-..." />
                    </Form.Field>

                    <Flex justify="end" className="mt-auto" gap={8}>
                        {id && (
                            <Popconfirm
                                icon={null}
                                content="确定删除模型"
                                okButtonProps={{ className: "bg-error" }}
                                onOk={handleDelete}
                            >
                                <Button secondary className="mr-auto error">
                                    删除
                                </Button>
                            </Popconfirm>
                        )}
                        <Button flat onClick={closeModal}>
                            取消
                        </Button>
                        <Button
                            loading={loading}
                            onClick={() => void handleSubmit()}
                        >
                            {id ? "更新" : "添加"}
                        </Button>
                    </Flex>
                </Form>
            </Flex>
        </Modal>
    );
}
