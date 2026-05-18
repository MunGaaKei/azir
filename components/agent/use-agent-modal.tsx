import { Modal } from "@ioca/react";
import type { Agent } from "@prisma/client";
import { AgentCreate, AgentModal } from "./modal";

export function useAgentModal() {
    const modal = Modal.useModal();

    const open = (agent?: Agent) => {
        modal.open({
            customized: true,
            width: agent ? 600 : 480,
            backdropClosable: false,
            children: agent ? (
                <AgentModal agent={agent} close={modal.close} />
            ) : (
                <AgentCreate close={modal.close} />
            ),
        });
    };

    return {
        openCreate: () => open(),
        openEdit: (agent: Agent) => open(agent),
    };
}
