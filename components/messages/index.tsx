import type { ChatMessage } from "@/stores/chat";
import { useChatStore } from "@/stores/chat";
import { throttle } from "@/utils";
import { Scroll } from "@ioca/react";
import {
    memo,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { AutoSizer } from "react-virtualized-auto-sizer";
import {
    List,
    useDynamicRowHeight,
    type ListImperativeAPI,
} from "react-window";
import css from "./index.module.css";
import { MessageItem } from "./message-item";
import { ScrollContext } from "./scroll-context";
import { SuggestionBar } from "./suggestion-bar";

const useIsomorphicLayoutEffect =
    typeof window === "undefined" ? useEffect : useLayoutEffect;

const VIRTUALIZE_THRESHOLD = 12;
const ROW_PADDING_BOTTOM = 36;

type DisplayRow =
    | { kind: "message"; message: ChatMessage }
    | { kind: "group"; messages: ChatMessage[] };

function buildDisplayRows(messages: ChatMessage[]): DisplayRow[] {
    const rows: DisplayRow[] = [];
    let i = 0;

    while (i < messages.length) {
        const current = messages[i];

        if (current.role === "user") {
            rows.push({ kind: "message", message: current });
            i++;
            continue;
        }

        // Collect consecutive assistant messages with the same requestId
        const requestId = current.requestId;
        const group: ChatMessage[] = [current];
        i++;

        while (i < messages.length) {
            const next = messages[i];
            if (
                next.role === "assistant" &&
                next.requestId &&
                next.requestId === requestId
            ) {
                group.push(next);
                i++;
            } else {
                break;
            }
        }

        if (group.length === 1) {
            rows.push({ kind: "message", message: group[0] });
        } else {
            rows.push({ kind: "group", messages: group });
        }
    }

    return rows;
}

type MessagesProps = {
    projectId: string;
};

export { ScrollContext };

export default function Messages({ projectId }: MessagesProps) {
    const allMessages = useChatStore((state) => state.messages);
    const retry = useChatStore((state) => state.retry);
    const stop = useChatStore((state) => state.stop);
    const messages = useMemo(
        () => allMessages.filter((message) => message.projectId === projectId),
        [allMessages, projectId],
    );
    const listRef = useRef<ListImperativeAPI>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const rowHeight = useDynamicRowHeight({ defaultRowHeight: 200 });
    const scrollCtx = useContext(ScrollContext);
    const lastForcedRequestIdRef = useRef<string | null>(null);
    const useVirtual = messages.length > VIRTUALIZE_THRESHOLD;

    const latestUserRequestId = useMemo(() => {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const message = messages[index];
            if (message.role === "user" && message.requestId) {
                return message.requestId;
            }
        }
        return null;
    }, [messages]);

    const hasStreaming = useMemo(
        () =>
            messages.some(
                (message) =>
                    message.role === "assistant" &&
                    message.status === "streaming",
            ),
        [messages],
    );

    const displayRows = useMemo(() => buildDisplayRows(messages), [messages]);

    const doScrollToBottom = useCallback(() => {
        const el = listRef.current?.element;
        if (el) {
            if (scrollCtx) scrollCtx.isProgrammaticScrollRef.current = true;
            el.scrollTop = el.scrollHeight;
            requestAnimationFrame(() => {
                if (scrollCtx)
                    scrollCtx.isProgrammaticScrollRef.current = false;
            });
        } else if (containerRef.current) {
            if (scrollCtx) scrollCtx.isProgrammaticScrollRef.current = true;
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
            requestAnimationFrame(() => {
                if (scrollCtx)
                    scrollCtx.isProgrammaticScrollRef.current = false;
            });
        }
    }, [scrollCtx]);

    const scrollToBottom = useCallback(() => {
        if (useVirtual) {
            requestAnimationFrame(doScrollToBottom);
        } else {
            doScrollToBottom();
        }
    }, [useVirtual, doScrollToBottom]);

    const handleResize = useRef(
        throttle(() => {
            if (scrollCtx?.hasUserScrolledRef.current) return;
            doScrollToBottom();
        }, 100),
    ).current;

    useEffect(() => {
        if (!copiedId) return;
        const timer = window.setTimeout(() => setCopiedId(null), 1500);
        return () => window.clearTimeout(timer);
    }, [copiedId]);

    useIsomorphicLayoutEffect(() => {
        if (!latestUserRequestId) return;
        if (!hasStreaming) return;
        if (lastForcedRequestIdRef.current === latestUserRequestId) return;
        lastForcedRequestIdRef.current = latestUserRequestId;
        if (scrollCtx) scrollCtx.hasUserScrolledRef.current = false;
        scrollToBottom();
    }, [latestUserRequestId, hasStreaming, scrollToBottom, scrollCtx]);

    useIsomorphicLayoutEffect(() => {
        if (!messages.length) return;
        if (!hasStreaming) return;
        if (scrollCtx?.hasUserScrolledRef.current) return;
        scrollToBottom();
    }, [messages, hasStreaming, scrollToBottom, scrollCtx]);

    const handleCopy = useCallback(async (id: string, content: string) => {
        if (!content.trim()) return;
        try {
            await navigator.clipboard.writeText(content);
            setCopiedId(id);
        } catch {}
    }, []);

    const sharedRowProps = useMemo(
        () => ({
            onCopy: handleCopy,
            onRetry: retry,
            onStop: stop,
        }),
        [handleCopy, retry, stop],
    );

    if (!messages.length) {
        return <SuggestionBar projectId={projectId} />;
    }

    if (!useVirtual) {
        return (
            <div ref={containerRef} className={css.scrollContainer}>
                {displayRows.map((row) => (
                    <div
                        key={
                            row.kind === "message"
                                ? row.message.id
                                : `group-${row.messages[0].id}`
                        }
                        className={css.virtualContainer}
                    >
                        {row.kind === "message" ? (
                            <MessageItem
                                copied={copiedId === row.message.id}
                                message={row.message}
                                {...sharedRowProps}
                            />
                        ) : (
                            <Scroll
                                className={css.agentGroup}
                                style={{
                                    display: "flex",
                                    gap: 24,
                                }}
                            >
                                {row.messages.map((msg) => (
                                    <MessageItem
                                        key={msg.id}
                                        className={css.agentGroupItem}
                                        copied={copiedId === msg.id}
                                        message={msg}
                                        {...sharedRowProps}
                                    />
                                ))}
                            </Scroll>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <AutoSizer
            className={css.messages}
            renderProp={({ height, width }) => (
                <List
                    listRef={listRef}
                    rowCount={displayRows.length}
                    rowHeight={rowHeight}
                    onResize={handleResize}
                    rowComponent={({ index, style }) => {
                        const row = displayRows[index];
                        return (
                            <div
                                style={style}
                                className={css.virtualContainer}
                            >
                                {row.kind === "message" ? (
                                    <MessageItem
                                        copied={copiedId === row.message.id}
                                        message={row.message}
                                        {...sharedRowProps}
                                    />
                                ) : (
                                    <Scroll
                                        className={css.agentGroup}
                                        style={{
                                            display: "flex",
                                            gap: 24,
                                        }}
                                    >
                                        {row.messages.map((msg) => (
                                            <MessageItem
                                                key={msg.id}
                                                className={css.agentGroupItem}
                                                copied={copiedId === msg.id}
                                                message={msg}
                                                {...sharedRowProps}
                                            />
                                        ))}
                                    </Scroll>
                                )}
                            </div>
                        );
                    }}
                    rowProps={{}}
                    overscanCount={3}
                    className={css.list}
                    style={{ height, width }}
                />
            )}
        />
    );
}
