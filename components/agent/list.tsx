import { AgentActivity, useActivityStore } from "@/stores/activity";
import { useAgentsStore } from "@/stores/agents";
import { Badge, Button } from "@ioca/react";
import { Agent } from "@prisma/client";
import clsx from "clsx";
import { PlusSquare } from "lucide-react";
import { useMemo, useRef } from "react";
import { BotAnimate, BotIconHandle } from "../ui/bot-animate";
import css from "./index.module.css";
import { useAgentModal } from "./use-agent-modal";

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

function getAgentIcon(name: string, used: Set<string>): string {
    const firstChar = name.trim()[0];
    const isChinese = (c: string) => /[一-鿿]/.test(c);

    let icon: string;
    if (firstChar && isChinese(firstChar)) {
        icon = firstChar;
    } else {
        const leading = name.trim().match(/^[a-zA-Z]+/)?.[0] || name.trim()[0] || "";
        icon = leading.slice(0, 2).toUpperCase();
    }

    if (used.has(icon)) {
        for (let i = icon.length; i < name.length; i++) {
            const c = (icon + name[i]).toUpperCase().replace(/\s/g, "");
            if (!used.has(c)) return c;
        }
    }

    return icon;
}

function AgentItem({ agent, icon }: { agent: Agent; icon: string }) {
    const botRef = useRef<BotIconHandle>(null);
    const fill = (agent.meta as any)?.color ?? "transparent";
    const { openEdit } = useAgentModal();

    const storeActivities = useActivityStore((state) => state.activities);
    const latestActivity = useMemo(
        () => getLatestActivity(agent, storeActivities),
        [agent, storeActivities],
    );

    return (
        <div
            className={css.item}
            onClick={() => openEdit(agent)}
            onMouseEnter={() => botRef.current?.startAnimation()}
            onMouseLeave={() => botRef.current?.stopAnimation()}
        >
            <Badge
                className={css.badge}
                content={latestActivity?.status}
                dot
                dotSize={12}
                disabled={
                    !latestActivity ||
                    !["running", "error"].includes(latestActivity?.status)
                }
                contentClass={clsx(
                    latestActivity
                        ? (statusToClass[latestActivity.status] ?? "")
                        : "",
                    "mt-4",
                )}
            >
                <BotAnimate ref={botRef} size={32} fill={fill} />

                <span className={css.icon}>{icon}</span>
            </Badge>

            <span className={css.name}>{agent.name}</span>
        </div>
    );
}

export default function AgentMenu() {
    const agents = useAgentsStore((state) => state.agents);
    const { openCreate } = useAgentModal();

    const agentIcons = useMemo(() => {
        const used = new Set<string>();
        const map = new Map<number, string>();
        for (const agent of agents) {
            const icon = getAgentIcon(agent.name, used);
            used.add(icon);
            map.set(agent.id, icon);
        }
        return map;
    }, [agents]);

    return (
        <>
            <Button flat square onClick={() => openCreate()}>
                <PlusSquare size={32} />
            </Button>

            <div className={css.list}>
                <div className={css.listInner}>
                    {agents.map((agent) => (
                        <AgentItem
                            key={agent.id}
                            agent={agent}
                            icon={agentIcons.get(agent.id) ?? ""}
                        />
                    ))}
                </div>
            </div>
        </>
    );
}
