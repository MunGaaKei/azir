import AgentActivity from "@/components/agent/activity";
import AgentList from "@/components/agent/list";
import type { Agent } from "@prisma/client";
import { useState } from "react";

export default function Page() {
    const [active, setActive] = useState<number | undefined>();

    const handleAgentClick = (agent: Agent) => {
        setActive(agent.id);
    };

    return (
        <>
            {!active && <AgentList onClick={handleAgentClick} />}

            {active && (
                <AgentActivity
                    agentId={active}
                    onSelect={(id) => setActive(id)}
                />
            )}
        </>
    );
}
