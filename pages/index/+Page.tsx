import { Aside } from "@/components/aside";
import AgentEditor from "@/components/editor";
import Projects from "@/components/projects";

export default function Page() {
    return (
        <>
            <Aside />

            <Projects />

            <AgentEditor />
        </>
    );
}
