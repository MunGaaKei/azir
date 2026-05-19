import { tryto } from "@/utils";
import { Button, Message, Popconfirm } from "@ioca/react";
import { Shredder, UserRoundKey } from "lucide-react";
import { useState } from "react";
import AgentList from "../agent/list";
import { useUidModal } from "../uid/modal";

export function Aside() {
    const [clearing, setClearing] = useState(false);
    const { open: openUid } = useUidModal();

    async function clearMemories() {
        setClearing(true);
        const { error } = await tryto(async () => {
            const res = await fetch("/api/memories", { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.message || "清空失败");
            }
        });

        if (error) {
            Message.error(error.message);
        } else {
            Message.info("记忆已清空");
        }
        setClearing(false);
    }

    return (
        <aside className="flex pd-12 flex-column gap-4">
            <a href="/" className="flex mb-12">
                <img src="/logo.png" alt="logo" width={28} height={28} />
            </a>

            <AgentList />

            <Popconfirm
                icon={null}
                content="清空所有记忆"
                okButtonProps={{ className: "bg-error" }}
                onOk={clearMemories}
            >
                <Button flat square className="mt-auto" loading={clearing}>
                    <Shredder />
                </Button>
            </Popconfirm>

            <Button flat square onClick={openUid}>
                <UserRoundKey />
            </Button>
        </aside>
    );
}
