import { useAgentModal } from "@/components/agent/modal";
import { useAgentsStore } from "@/stores/agents";
import { Button, Dropdown } from "@ioca/react";
import { Bot, CornerUpLeft, Settings } from "lucide-react";
import css from "./index.module.css";

export default function AgentActivity({
    onSelect,
    agentId,
}: {
    onSelect: (id?: number) => void;
    agentId: number;
}) {
    const { openEdit } = useAgentModal();
    const agents = useAgentsStore((state) => state.agents);
    const agent = useAgentsStore((state) =>
        state.agents.find((item) => item.id === agentId),
    );

    if (!agent) {
        return;
    }

    return (
        <>
            <header className={css.header}>
                <Button flat square onClick={() => onSelect(undefined)}>
                    <CornerUpLeft />
                </Button>

                <Dropdown
                    content={(close) => {
                        return agents.map((agent) => (
                            <Dropdown.Item
                                key={agent.id}
                                type="option"
                                active={agent.id === agentId}
                                onClick={() => {
                                    onSelect(agent.id);
                                    close();
                                }}
                            >
                                {agent.name}
                            </Dropdown.Item>
                        ));
                    }}
                >
                    <Button flat style={{ fontSize: 16 }}>
                        <Bot size={24} /> {agent.name}
                    </Button>
                </Dropdown>

                <Button
                    flat
                    square
                    className="ml-auto"
                    onClick={() => openEdit(agent)}
                >
                    <Settings />
                </Button>
            </header>
        </>
    );
}
