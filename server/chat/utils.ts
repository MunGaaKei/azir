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
