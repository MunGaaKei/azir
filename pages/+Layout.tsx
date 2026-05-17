import Footer from "@/components/footer";
import Header from "@/components/header";
import { useAgentsStore } from "@/stores/agents";
import { useModelsStore } from "@/stores/models";
import { useEffect } from "react";
import css from "./index.module.css";

export default function Layout({ children }: { children: React.ReactNode }) {
    const initAgents = useAgentsStore((state) => state.initAgents);
    const initModels = useModelsStore((state) => state.initModels);

    useEffect(() => {
        void Promise.all([initAgents(), initModels()]).catch((error) => {
            console.error("Failed to initialize app data", error);
        });
    }, [initAgents, initModels]);

    return (
        <div className={css.layout}>
            <Header />

            <div className={css.content}>{children}</div>

            <Footer />
        </div>
    );
}
