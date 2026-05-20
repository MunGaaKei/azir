import Messages, { ScrollContext } from "@/components/messages";
import { useChatStore } from "@/stores/chat";
import { Button, Input, Popconfirm } from "@ioca/react";
import clsx from "clsx";
import { MessageSquarePlus, Shredder, SquareX } from "lucide-react";
import { useEffect, useRef } from "react";
import Drive from "./drive";
import css from "./index.module.css";

function ClearButton({ projectId }: { projectId: string }) {
    const messageLength = useChatStore(
        (state) =>
            state.messages.filter((message) => message.projectId === projectId)
                .length,
    );
    const clearMessages = useChatStore((state) => state.clearMessages);

    if (messageLength === 0) return null;

    return (
        <Popconfirm
            icon={null}
            content="确定要清空对话"
            okButtonProps={{ className: "bg-error" }}
            onOk={() => {
                clearMessages(projectId);
            }}
        >
            <Button flat square>
                <Shredder size={20} />
            </Button>
        </Popconfirm>
    );
}

export default function Projects() {
    const projects = useChatStore((state) => state.projects);
    const addProject = useChatStore((state) => state.addProject);
    const setCurrentProject = useChatStore((state) => state.setCurrentProject);
    const removeProject = useChatStore((state) => state.removeProject);
    const setProjectName = useChatStore((state) => state.setProjectName);
    const currentProjectId = useChatStore((state) => state.currentProjectId);
    const hasUserScrolledRef = useRef(false);
    const isProgrammaticScrollRef = useRef(false);

    useEffect(() => {
        const handleUserScroll = () => {
            if (isProgrammaticScrollRef.current) return;
            hasUserScrolledRef.current = true;
        };
        window.addEventListener("wheel", handleUserScroll, { passive: true });
        window.addEventListener("touchmove", handleUserScroll, {
            passive: true,
        });
        window.addEventListener("pointerdown", handleUserScroll, {
            passive: true,
        });
        return () => {
            window.removeEventListener("wheel", handleUserScroll);
            window.removeEventListener("touchmove", handleUserScroll);
            window.removeEventListener("pointerdown", handleUserScroll);
        };
    }, []);

    return (
        <div className={css.container}>
            {projects.map((project) => (
                <div
                    key={project.id}
                    className={clsx(css.project, {
                        [css.active]: project.id === currentProjectId,
                    })}
                    onClick={(event) => {
                        const target = event.target as HTMLElement;
                        const current = event.currentTarget as HTMLElement;
                        if (!current.contains(target)) return;
                        if (
                            target.closest("button, a, input, textarea, select")
                        )
                            return;
                        setCurrentProject(project.id);
                    }}
                >
                    <div className={css.header}>
                        <Input
                            className="mr-auto font-bold"
                            border
                            style={{ borderWidth: 0 }}
                            placeholder="UNTITLED"
                            value={project.name}
                            onChange={(value) =>
                                setProjectName(project.id, String(value ?? ""))
                            }
                        />

                        <Drive projectId={project.id} />

                        <ClearButton projectId={project.id} />

                        <Button
                            flat
                            square
                            onClick={(event) => {
                                event.stopPropagation();
                                addProject();
                            }}
                        >
                            <MessageSquarePlus size={20} />
                        </Button>

                        {project.id !== "default-project" && (
                            <Popconfirm
                                icon={null}
                                content="确认关闭窗口"
                                okButtonProps={{ className: "bg-error" }}
                                onOk={() => {
                                    removeProject(project.id);
                                }}
                            >
                                <Button flat square>
                                    <SquareX size={20} />
                                </Button>
                            </Popconfirm>
                        )}
                    </div>

                    <ScrollContext.Provider
                        value={{ hasUserScrolledRef, isProgrammaticScrollRef }}
                    >
                        <Messages projectId={project.id} />
                    </ScrollContext.Provider>
                </div>
            ))}
        </div>
    );
}
