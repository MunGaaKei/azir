import type { Model } from "@prisma/client";

export const MODEL_MODAL_OPEN_TOPIC = "model-modal:open";

export const required = {
    validator: (value: unknown) => !!value,
    message: "",
};

export function getModelFormValues(model: Model) {
    return {
        name: model.name,
        apiUrl: model.apiUrl,
        apiKey: model.apiKey,
    };
}
