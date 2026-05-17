import { useAgentsStore } from "@/stores/agents";
import { Button } from "@ioca/react";
import { Agent } from "@prisma/client";
import { Plus } from "lucide-react";
import { useRef } from "react";
import { BotAnimate, type BotIconHandle } from "../ui/bot-animate";
import css from "./index.module.css";
import { useAgentModal } from "./modal";

function AgentListItem({
    agent,
    onClick,
}: {
    agent: Agent;
    onClick: (agent: Agent) => void;
}) {
    const botRef = useRef<BotIconHandle>(null);

    return (
        <div
            key={agent.id}
            className={css.item}
            onClick={() => onClick(agent)}
            onMouseEnter={() => botRef.current?.startAnimation()}
            onMouseLeave={() => botRef.current?.stopAnimation()}
        >
            <BotAnimate ref={botRef} size={36} />
            <b>{agent.name}</b>
        </div>
    );
}

export default function AgentList({
    onClick,
}: {
    onClick: (agent: Agent) => void;
}) {
    const agents = useAgentsStore((state) => state.agents);
    const { openCreate } = useAgentModal();

    return (
        <div className={css.list}>
            {agents.map((agent) => (
                <AgentListItem key={agent.id} agent={agent} onClick={onClick} />
            ))}

            <Button
                secondary
                square
                className="mg-auto round"
                size="large"
                onClick={openCreate}
            >
                <Plus />
            </Button>
        </div>
    );
}
