import request from "@/server/request";
import { useModelsStore } from "@/stores/models";
import { tryto } from "@/utils";
import {
    Button,
    Checkbox,
    Dropdown,
    Flex,
    Form,
    Input,
    List,
    Modal,
    Popup,
} from "@ioca/react";
import type { Model } from "@prisma/client";
import { Inbox, Plus } from "lucide-react";
import PubSub from "pubsub-js";
import { useEffect, useState } from "react";
import { BrainAnimate } from "../ui/brain-animate";
import css from "./index.module.css";

const MODEL_MODAL_OPEN_TOPIC = "model-modal:open";

const required = {
    validator: (value) => !!value,
    message: "",
};

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
                    handleSelectModel(model);
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

    const handleSelectModel = (model: Model) => {
        setId(String(model.id));
        form.set({
            name: model.name,
            api_url: model.api_url,
            api_key: model.api_key,
        });
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
            setLoading(false);
            throw error;
        }

        const nextModels = id
            ? models.map((model) => {
                  return model.id === data.id ? data : model;
              })
            : [...models, data].sort((a, b) => a.id - b.id);

        setModels(nextModels);
        closeModal();
    };

    return (
        <Modal
            customized
            visible={visible}
            width={420}
            backdropClosable={false}
            onClose={closeModal}
        >
            <div className={css.header}>
                <b className="mr-auto py-4">模型管理</b>
                {id && (
                    <Popup
                        content="该模型会用来处理Agent分配"
                        className="pd-12 bg-1"
                        showDelay={320}
                    >
                        <Checkbox.Item
                            type="switch"
                            className={css.switch}
                            label="导航模型"
                        />
                    </Popup>
                )}
            </div>

            <Flex>
                <ul className={css.list}>
                    {models.map((model) => {
                        return (
                            <List.Item
                                key={model.id}
                                type="option"
                                className={css.item}
                                onClick={() => handleSelectModel(model)}
                            >
                                {model.name}
                            </List.Item>
                        );
                    })}

                    {!models.length && (
                        <div className="flex py-20 justify-center">
                            <Inbox color="var(--color-5)" />
                        </div>
                    )}

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
                        api_url: required,
                        api_key: required,
                    }}
                >
                    <Form.Field name="name" required>
                        <Input label="名称" border />
                    </Form.Field>
                    <Form.Field name="api_url" required>
                        <Input label="API Url" border />
                    </Form.Field>
                    <Form.Field name="api_key" required>
                        <Input label="API Key" border type="password" />
                    </Form.Field>

                    <Flex justify="end" className="mt-auto">
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

export function ModelDropdown() {
    const models = useModelsStore((state) => state.models);

    return (
        <>
            <Dropdown
                content={(close) => {
                    return (
                        <>
                            {models.map((model) => (
                                <Dropdown.Item
                                    key={model.id}
                                    type="option"
                                    onClick={() => {
                                        close();
                                        PubSub.publish(
                                            MODEL_MODAL_OPEN_TOPIC,
                                            model,
                                        );
                                    }}
                                >
                                    {model.name}
                                </Dropdown.Item>
                            ))}

                            <Button
                                className="mt-4"
                                secondary
                                size="small"
                                onClick={() => {
                                    close();
                                    PubSub.publish(MODEL_MODAL_OPEN_TOPIC);
                                }}
                            >
                                <Plus size={20} />
                            </Button>
                        </>
                    );
                }}
                width={120}
            >
                <Button square flat>
                    <BrainAnimate size={22} />
                </Button>
            </Dropdown>

            <ModelModal />
        </>
    );
}
