import type { FileSession } from "./memories/file-session";
import { extractMessageText, truncate } from "./utils";

const SUMMARY_MAX_ITEMS = 8;
const SUMMARY_MAX_LENGTH = 2000;
const SUMMARY_MAX_CHARS_PER_MESSAGE = 400;

export async function buildConversationSummary(session: FileSession): Promise<string> {
    const items = await session.getItems(SUMMARY_MAX_ITEMS);
    const parts: string[] = [];
    let total = 0;

    for (const item of items) {
        const extracted = extractMessageText(
            item as { role?: string; content?: unknown },
        );
        if (!extracted) continue;

        const truncated = truncate(
            extracted.text,
            SUMMARY_MAX_CHARS_PER_MESSAGE,
        );
        const line = extracted.prefix + truncated;
        total += line.length;

        if (total > SUMMARY_MAX_LENGTH && parts.length > 0) {
            break;
        }
        parts.push(line);
    }

    return parts.join("\n");
}
