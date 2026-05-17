import { useAgentsStore } from "@/stores/agents";
import { type ChatMessage } from "@/stores/chat";
import { parseMentionContent } from "@/utils/mention";
import { Fragment, memo, useMemo } from "react";
import css from "./index.module.css";

type UserContentProps = {
    message: ChatMessage;
};

export const UserContent = memo(function UserContent({
    message,
}: UserContentProps) {
    const agents = useAgentsStore((state) => state.agents);
    const agentOptions = useMemo(
        () =>
            agents.map((agent) => ({
                label: agent.name,
                value: agent.id,
            })),
        [agents],
    );
    const segments = useMemo(
        () =>
            parseMentionContent(
                message.displayContent ?? message.content,
                agentOptions,
            ),
        [message.displayContent, message.content, agentOptions],
    );

    return (
        <div className={css.plain}>
            {segments.map((segment, index) =>
                segment.type === "mention" ? (
                    <a
                        key={`${message.id}-mention-${index}`}
                        className="i-memtion-tag"
                        data-memtion-value={segment.id}
                    >
                        @{segment.label}
                    </a>
                ) : (
                    <Fragment key={`${message.id}-text-${index}`}>
                        {segment.content}
                    </Fragment>
                ),
            )}
        </div>
    );
});
