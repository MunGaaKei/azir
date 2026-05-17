import { Button } from "@ioca/react";
import PubSub from "pubsub-js";
import { LayersIcon } from "../ui/layer-animate";
import { SKILL_MODAL_OPEN_TOPIC } from "./utils";

export function openSkillModal() {
    PubSub.publish(SKILL_MODAL_OPEN_TOPIC);
}

export function ManageSkillButton() {
    return (
        <Button secondary square onClick={() => openSkillModal()}>
            <LayersIcon size={20} />
        </Button>
    );
}
