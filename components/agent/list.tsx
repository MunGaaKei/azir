import { useActivityStore } from "@/stores/activity";
import { useAgentsStore } from "@/stores/agents";
import { Button } from "@ioca/react";
import type { Agent } from "@prisma/client";
import type { AgentActivity } from "@/stores/type";
import { SquarePlus } from "lucide-react";
import { useMemo, useRef } from "react";
import { BotAnimate, type BotIconHandle } from "../ui/bot-animate";
import css from "./index.module.css";
import { useAgentModal } from "./modal";

const statusToClass: Partial<Record<AgentActivity["status"], string>> = {
    running: css.running,
    error: css.error,
    done: css.done,
};

function getLatestActivity(agent: Agent, activities: AgentActivity[]) {
    const agentActivities = activities.filter((a) => a.agentId === agent.id);
    if (!agentActivities.length) return;
    return agentActivities.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

function AgentListItem({
    agent,
    onEdit,
}: {
    agent: Agent;
    onEdit: (agent: Agent) => void;
}) {
    const botRef = useRef<BotIconHandle>(null);
    const fill = (agent.meta as any)?.color ?? "transparent";
    const storeActivities = useActivityStore((state) => state.activities);
    const latestActivity = useMemo(() => getLatestActivity(agent, storeActivities), [agent, storeActivities]);

    return (
        <a
            className={css.item}
            onMouseEnter={() => botRef.current?.startAnimation()}
            onMouseLeave={() => botRef.current?.stopAnimation()}
            onClick={() => onEdit(agent)}
        >
            <BotAnimate ref={botRef} size={32} fill={fill} />
            <span>{agent.name}</span>

            <span className={`${css.status} ${latestActivity ? statusToClass[latestActivity.status] ?? "" : ""}`} />
        </a>
    );
}

export default function AgentList() {
    const agents = useAgentsStore((state) => state.agents);
    const { openCreate, openEdit } = useAgentModal();

    return (
        <div className={css.list}>
            {agents.map((agent) => (
                <AgentListItem key={agent.id} agent={agent} onEdit={openEdit} />
            ))}

            <div className={css.add}>
                <Button flat square onClick={openCreate}>
                    <SquarePlus size={24} />
                </Button>
            </div>
        </div>
    );
}
