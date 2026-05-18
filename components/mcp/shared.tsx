import { Button } from "@ioca/react";
import PubSub from "pubsub-js";
import { CpuAnimate } from "../ui/cpu-animate";
import { MCP_MODAL_OPEN_TOPIC } from "./types";

export function openMcpModal() {
    PubSub.publish(MCP_MODAL_OPEN_TOPIC);
}

export function ManageMCPButton() {
    return (
        <Button secondary square onClick={() => openMcpModal()}>
            <CpuAnimate size={20} />
        </Button>
    );
}
