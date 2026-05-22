import { Button } from "@ioca/react";
import { Cog } from "lucide-react";
import AgentList from "../agent/list";
import Documents from "../documents";
import { useUidModal } from "../uid/modal";

export function Aside() {
    const { open: openUid } = useUidModal();

    return (
        <aside className="flex pd-12 flex-column gap-12">
            <a href="/" className="flex mb-4">
                <img src="/logo.png" alt="logo" width={28} height={28} />
            </a>

            <AgentList />

            <Documents />

            <Button flat square onClick={openUid}>
                <Cog />
            </Button>
        </aside>
    );
}
