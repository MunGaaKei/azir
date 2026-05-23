import { useAgentsStore } from "@/stores/agents";
import { useChatStore } from "@/stores/chat";
import { Button, Editor, Upload } from "@ioca/react";
import { CornerRightUp, Paperclip } from "lucide-react";
import { type KeyboardEvent, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import css from "./index.module.css";
import ControlSetting from "./setting";
import {
    type AttachedFile,
    type UploadFileLike,
    buildAttachedFiles,
    createAgentOptions,
    insertMention,
    resolveAttachedFileChanges,
    resolveSubmitPayload,
    toAttachedFilesPayload,
} from "./utils";

const MAX_FILES = 3;

export default function AgentEditor() {
    const [value, setValue] = useState("");
    const [uploadFiles, setUploadFiles] = useState<UploadFileLike[]>([]);
    const [files, setFiles] = useState<AttachedFile[]>([]);
    const agents = useAgentsStore((state) => state.agents);
    const currentProjectId = useChatStore((state) => state.currentProjectId);
    const send = useChatStore((state) => state.send);
    const agentOptions = useMemo(() => createAgentOptions(agents), [agents]);

    const handleFilesChange = (
        nextFiles: UploadFileLike[],
        changed: UploadFileLike[],
    ) => {
        setUploadFiles(nextFiles);
        const { addedFiles, removedIds } = resolveAttachedFileChanges(
            files,
            nextFiles,
            changed,
        );

        if (removedIds.length > 0) {
            setFiles((prev) =>
                prev.filter((file) => !removedIds.includes(file.id)),
            );
        }

        if (addedFiles.length > 0) {
            void buildAttachedFiles(addedFiles).then((enriched) => {
                setFiles((prev) => [...prev, ...enriched]);
            });
        }
    };

    const submit = () => {
        const { prompt, agentIds, displayContent } = resolveSubmitPayload(
            value,
            agentOptions,
        );
        const hasFiles = files.length > 0;
        if (!prompt && !hasFiles) {
            return Promise.reject();
        }

        flushSync(() => {
            setValue("");
        });

        const filesPayload = toAttachedFilesPayload(files);

        flushSync(() => {
            setFiles([]);
            setUploadFiles([]);
        });

        void send({
            prompt,
            projectId: currentProjectId,
            agentIds,
            displayContent,
            files: filesPayload,
        }).catch(() => undefined);

        return Promise.resolve(true);
    };

    const handleEnter = (e: KeyboardEvent<HTMLDivElement>) => {
        const nativeEvent = e.nativeEvent as {
            isComposing?: boolean;
            keyCode?: number;
        };
        if (nativeEvent.isComposing || nativeEvent.keyCode === 229) {
            return;
        }

        void submit();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Tab") return;
        e.preventDefault();
        const projects = useChatStore.getState().projects;
        const currentId = useChatStore.getState().currentProjectId;
        const currentIndex = projects.findIndex((p) => p.id === currentId);
        const nextIndex = e.shiftKey
            ? (currentIndex - 1 + projects.length) % projects.length
            : (currentIndex + 1) % projects.length;
        useChatStore.getState().setCurrentProject(projects[nextIndex].id);
    };

    const chatMode = useChatStore((s) => s.chatMode);
    const setChatMode = useChatStore((s) => s.setChatMode);

    return (
        <footer className={css.editor}>
            <div className={css.controls}>
                <Upload
                    mode="card"
                    cardSize="2.25em"
                    className={css.upload}
                    files={uploadFiles}
                    multiple
                    icon={<Paperclip size={20} />}
                    limit={MAX_FILES}
                    onFilesChange={handleFilesChange}
                />

                <ControlSetting chatMode={chatMode} onChange={setChatMode} />

                <Button flat square onClick={submit}>
                    <CornerRightUp size="20" />
                </Button>
            </div>

            <Editor
                placeholder={
                    files.length > 0
                        ? "描述你要对这些文件做什么..."
                        : "你想要做些什么"
                }
                hideControl
                autosize
                mode="plaintextOnMemtion"
                border={false}
                height="6em"
                autoFocus
                spellCheck={false}
                value={value}
                memtion={useMemo(
                    () => [
                        {
                            key: "@",
                            options: agentOptions,
                            insert: insertMention,
                        },
                    ],
                    [agentOptions],
                )}
                onChange={setValue}
                onEnter={handleEnter}
                onKeyDown={handleKeyDown}
            />
        </footer>
    );
}
