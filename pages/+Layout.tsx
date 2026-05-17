import { useAgentsStore } from "@/stores/agents";
import { useModelsStore } from "@/stores/models";
import { Loading, Message } from "@ioca/react";
import { useEffect } from "react";
import { ClientOnly } from "vike-react/ClientOnly";
import css from "./index.module.css";

export default function Layout({ children }: { children: React.ReactNode }) {
    const initAgents = useAgentsStore((state) => state.initAgents);
    const initModels = useModelsStore((state) => state.initModels);

    useEffect(() => {
        void Promise.all([initAgents(), initModels()]).catch((error) => {
            console.error("初始化失败", error);
            Message.error("初始化失败");
        });
    }, [initAgents, initModels]);

    return (
        <ClientOnly fallback={<Loading absolute />}>
            <div className={css.layout}>{children}</div>
        </ClientOnly>
    );
}
