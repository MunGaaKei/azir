import { useChatStore } from "@/stores/chat";
import { Button, Flex } from "@ioca/react";
import { Orbit, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { type Suggestion, DEFAULT_SUGGESTIONS } from "./constant";

function pickRandom(): Suggestion {
    return DEFAULT_SUGGESTIONS[
        Math.floor(Math.random() * DEFAULT_SUGGESTIONS.length)
    ];
}

type SuggestionBarProps = {
    projectId: string;
};

export function SuggestionBar({ projectId }: SuggestionBarProps) {
    const send = useChatStore((state) => state.send);
    const loading = useChatStore((state) => state.loading);
    const [suggestion, setSuggestion] = useState(pickRandom);

    const handleSend = () => {
        if (loading) return;

        void send({
            prompt: suggestion.text,
            projectId,
            displayContent: suggestion.text,
        }).catch(() => undefined);
    };

    const handleRefresh = useCallback(() => {
        setSuggestion(pickRandom());
    }, []);

    return (
        <Flex
            direction="column"
            align="center"
            justify="center"
            className="mg-auto"
        >
            <Flex gap={12} align="center">
                <Sparkles size={24} fill="var(--blue-0)" />
                <b>{suggestion.text}</b>
            </Flex>

            <Flex gap={12} align="center" className="mt-12">
                <Button flat onClick={handleRefresh}>
                    换一条
                </Button>
                <Button secondary className="bg-blue-0" onClick={handleSend}>
                    {suggestion.buttonLabel} <Orbit size={16} />
                </Button>
            </Flex>
        </Flex>
    );
}
