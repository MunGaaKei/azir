import { Button } from "@ioca/react";
import type { Model } from "@prisma/client";
import { Plus } from "lucide-react";
import PubSub from "pubsub-js";
import { BrainAnimate } from "../ui/brain-animate";
import { MODEL_MODAL_OPEN_TOPIC } from "./utils";

export function openModelModal(model?: Model) {
    PubSub.publish(MODEL_MODAL_OPEN_TOPIC, model);
}

export function CreateModelButton({
    onBeforeOpen,
}: {
    onBeforeOpen?: () => void;
}) {
    return (
        <Button
            className="mt-4"
            secondary
            size="small"
            onClick={() => {
                onBeforeOpen?.();
                openModelModal();
            }}
        >
            <Plus size={20} />
        </Button>
    );
}

export function OpenModelModalButton({
    size = 20,
}: {
    size?: number;
}) {
    return (
        <Button
            secondary
            square
            onClick={() => {
                openModelModal();
            }}
        >
            <BrainAnimate size={size} />
        </Button>
    );
}
