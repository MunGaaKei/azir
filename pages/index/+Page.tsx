import { useAgentsStore } from "@/stores/agents";
import { useModelsStore } from "@/stores/models";

export default function Page() {
    const agents = useAgentsStore((state) => state.agents);
    const models = useModelsStore((state) => state.models);

    return <div></div>;
}
