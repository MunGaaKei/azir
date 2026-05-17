import { useAgentsStore } from "@/stores/agents";
import { Button, Editor, Upload } from "@ioca/react";
import { useState } from "react";
import css from "./index.module.css";

export default function Footer() {
    const [value, setValue] = useState("");
    const agents = useAgentsStore((state) => state.agents);
    const agentOptions = agents.map((agent) => ({
        label: agent.name,
        value: agent.id,
    }));

    return (
        <footer className={css.footer}>
            <div className={css.controls}>
                <Upload mode="card" cardSize="2.25em" className={css.upload} />
                <Button flat className="ml-auto">
                    发送
                </Button>
            </div>

            <Editor
                placeholder="你想要做些什么"
                hideControl
                autosize
                mode="plaintextOnMemtion"
                border={false}
                height="6em"
                autoFocus
                value={value}
                memtion={{
                    options: agentOptions,
                    insert: (option) => {
                        return "@" + option.label;
                    },
                }}
                onChange={setValue}
            />
        </footer>
    );
}
