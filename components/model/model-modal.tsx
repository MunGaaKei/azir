import request, { useAbort } from "@/server/request";
import { useModelsStore } from "@/stores/models";
import { tryto } from "@/utils";
import { Form, Input } from "@ioca/react";
import type { Model } from "@prisma/client";
import { BrainCog } from "lucide-react";
import PubSub from "pubsub-js";
import { useEffect, useState } from "react";
import {
    SettingFooter,
    SettingModal,
    SettingPanel,
    SettingSidebar,
} from "../modalSetting";
import { getModelFormValues, MODEL_MODAL_OPEN_TOPIC, required } from "./utils";

export function ModelModal() {
    const models = useModelsStore((state) => state.models);
    const initModels = useModelsStore((state) => state.initModels);
    const setModels = useModelsStore((state) => state.setModels);
    const form = Form.useForm();
    const [visible, setVisible] = useState(false);
    const [id, setId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const { signal, cancel } = useAbort();

    useEffect(() => {
        initModels().catch(() => undefined);

        const token = PubSub.subscribe(
            MODEL_MODAL_OPEN_TOPIC,
            (_: string, model?: Model) => {
                if (model) {
                    setId(model.id);
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
        cancel();
        setVisible(false);
        setId(null);
        form.clear();
    };

    const handleDelete = async () => {
        if (id === null) return;

        const { error } = await tryto(
            request(`/api/model/${id}`, {
                method: "DELETE",
                signal: signal(),
            }),
        );

        if (
            error &&
            !(error instanceof DOMException && error.name === "AbortError")
        )
            return;

        setModels(models.filter((m) => m.id !== id));
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
                signal: signal(),
            }),
        );

        setLoading(false);

        if (error || !data) {
            if (
                error instanceof DOMException &&
                error.name === "AbortError"
            )
                return;
            throw error;
        }

        const nextModels = id
            ? models.map((model) => (model.id === data.id ? data : model))
            : [...models, data].sort((a, b) => a.id - b.id);

        setModels(nextModels);
        closeModal();
    };

    const handleSelect = (selectedId: number | string) => {
        const model = models.find((m) => m.id === Number(selectedId));
        if (model) {
            setId(model.id);
            form.set(getModelFormValues(model));
        }
    };

    const handleNew = () => {
        form.clear();
        setId(null);
    };

    return (
        <SettingModal
            visible={visible}
            onClose={closeModal}
            title="模型管理"
            icon={BrainCog}
            width={600}
        >
            <SettingSidebar
                items={models}
                editingId={id}
                onSelect={handleSelect}
                onCreate={handleNew}
                renderItem={(m) => m.name}
            />
            <SettingPanel>
                <Form
                    form={form}
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
                        <Input
                            label="API Url"
                            border
                            placeholder="https://api.openai.com/v1"
                        />
                    </Form.Field>
                    <Form.Field name="apiKey" required>
                        <Input
                            label="API Key"
                            border
                            type="password"
                            placeholder="sk-..."
                        />
                    </Form.Field>
                </Form>

                <SettingFooter
                    editing={id !== null}
                    onDelete={handleDelete}
                    onCancel={closeModal}
                    onSubmit={() => void handleSubmit()}
                    submitting={loading}
                />
            </SettingPanel>
        </SettingModal>
    );
}
