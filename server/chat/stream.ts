import type { ChatStreamEvent } from "../../stores/type";

export type StreamWriter = WritableStreamDefaultWriter<Uint8Array>;

type RunItemStreamEventPayload = {
    name: string;
    item: {
        agent?: {
            name: string;
        };
        rawItem?: {
            name?: string;
            content?: Array<{
                type: "output_text";
                text: string;
            }>;
        };
    };
};

export type { RunItemStreamEventPayload };

export function encodeSseEvent(event: ChatStreamEvent) {
    return `data: ${JSON.stringify(event)}\n\n`;
}

export async function writeEvent(
    writer: StreamWriter,
    encoder: TextEncoder,
    event: ChatStreamEvent,
) {
    await writer.write(encoder.encode(encodeSseEvent(event)));
}
