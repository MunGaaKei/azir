import { useAgentsStore } from "@/stores/agents";
import { Button } from "@ioca/react";
import { memo } from "react";
import { useAgentModal } from "../agent/use-agent-modal";

type AgentTagProps = {
    agentId: number;
    agentName: string;
};

export const AgentTag = memo(function AgentTag({
    agentId,
    agentName,
}: AgentTagProps) {
    const agents = useAgentsStore((state) => state.agents);
    const { openEdit } = useAgentModal();
    const agent = agents.find((a) => a.id === agentId);

    if (!agent) return;

    return (
        <Button
            size="small"
            style={{
                background: (agent.meta as { color?: string }).color,
                color: "var(--black)",
            }}
            onClick={() => openEdit(agent!)}
        >
            {agentName}
        </Button>
    );
});
