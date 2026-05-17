import { type ChatMessage } from "@/stores/chat";
import { Button, Flex, Loading } from "@ioca/react";
import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import clsx from "clsx";
import "katex/dist/katex.min.css";
import { Bot, Check, CloudDownload, Copy, RotateCcw } from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import { Streamdown } from "streamdown";
import { AgentTag } from "./agent-tag";
import { downloadFile } from "./download";
import css from "./index.module.css";
import { MarkdownComponents } from "./markdown";
import cssMd from "./markdown.module.css";
import { getMessageRenderData } from "./message-content";
import { UserContent } from "./user-content";
const math = createMathPlugin({ singleDollarTextMath: true });

type MessageItemProps = {
    copied: boolean;
    message: ChatMessage;
    onCopy: (id: string, content: string) => void;
    onRetry: (requestId: string) => void;
    onStop: (messageId: string, requestId?: string) => void;
};

export const MessageItem = memo(function MessageItem({
    copied,
    message,
    onCopy,
    onRetry,
    onStop,
}: MessageItemProps) {
    const { files, isAssistant, streamContent, stopped } = useMemo(
        () => getMessageRenderData(message),
        [message],
    );

    const handleCopy = useCallback(() => {
        void onCopy(message.id, streamContent);
    }, [onCopy, message.id, streamContent]);

    return (
        <div
            className={clsx(
                css.message,
                isAssistant ? css.assistant : css.user,
            )}
        >
            {isAssistant && (
                <Flex className={css.messageHeader} align="center" gap={8}>
                    <Bot size={28} fill="var(--red-0)" />
                    {message.agentId != null && message.agentName && (
                        <AgentTag
                            agentId={message.agentId}
                            agentName={message.agentName}
                        />
                    )}

                    {message.status === "streaming" ? (
                        <Button
                            className={css.stopBtn}
                            flat
                            size="small"
                            onClick={() =>
                                onStop(message.id, message.requestId)
                            }
                        >
                            中断
                        </Button>
                    ) : null}
                </Flex>
            )}
            <div
                className={clsx(
                    css.body,
                    isAssistant ? css.assistantBody : css.userBody,
                )}
            >
                {isAssistant ? (
                    <>
                        <Streamdown
                            className={cssMd.markdown}
                            components={MarkdownComponents}
                            plugins={{ math, code }}
                            isAnimating={message.status === "streaming"}
                            mode="streaming"
                        >
                            {streamContent}
                        </Streamdown>

                        {files.length ? (
                            <div className={css.fileActions}>
                                {files.map((file) => (
                                    <Button
                                        key={`${message.id}-${file.filename}`}
                                        onClick={() => void downloadFile(file)}
                                    >
                                        <CloudDownload size={16} />
                                        <span>{file.filename}</span>
                                    </Button>
                                ))}
                            </div>
                        ) : null}

                        {message.status === "streaming" && (
                            <Loading
                                style={{
                                    display: "inline-flex",
                                    marginBlock: 4,
                                }}
                            />
                        )}

                        {stopped ? (
                            <div className={css.stopped}>已停止生成</div>
                        ) : null}
                    </>
                ) : (
                    <UserContent message={message} />
                )}
            </div>

            <div className={css.action}>
                <Button flat size="small" square onClick={handleCopy}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>

                {isAssistant && message.requestId ? (
                    <Button
                        flat
                        size="small"
                        square
                        onClick={() => void onRetry(message.requestId ?? "")}
                    >
                        <RotateCcw size={14} />
                    </Button>
                ) : null}
            </div>
        </div>
    );
});
