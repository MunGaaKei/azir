import { randomUUID } from "node:crypto";
import path from "node:path";

export function createActivityId() {
    return randomUUID();
}

export function toErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "请求处理失败";
}

export function sanitizeFilename(filename: string, index: number) {
    const base = path.basename(filename || `file-${index}`);
    return base || `file-${index}`;
}

export function truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + "… (省略)";
}

export type ExtractedMessage = { prefix: string; text: string };

export function extractMessageText(
    raw: { role?: string; content?: unknown },
): ExtractedMessage | null {
    if (raw.role === "user") {
        const text =
            typeof raw.content === "string"
                ? raw.content
                : Array.isArray(raw.content)
                  ? raw.content
                        .filter(
                            (c: { type?: string; text?: string }) =>
                                c.type === "input_text",
                        )
                        .map((c: { text?: string }) => c.text)
                        .join(" ")
                  : "";
        return text ? { prefix: "用户: ", text: text.trim() } : null;
    }
    if (raw.role === "assistant") {
        const text = Array.isArray(raw.content)
            ? raw.content
                  .filter(
                      (c: { type?: string; text?: string }) =>
                          c.type === "output_text",
                  )
                  .map((c: { text?: string }) => c.text)
                  .join("")
            : "";
        return text ? { prefix: "助手: ", text: text.trim() } : null;
    }
    return null;
}

export function extractJsonObject(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
        return "";
    }

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch?.[1]) {
        return fencedMatch[1].trim();
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
        return trimmed.slice(start, end + 1);
    }

    return trimmed;
}
