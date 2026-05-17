import { resolveMentionPayload, type MentionOption } from "@/utils/mention";
import type { ReactNode } from "react";

export function createAgentOptions(
    agents: Array<{
        id: number;
        name: string;
    }>,
) {
    return agents.map((agent) => ({
        label: agent.name,
        value: agent.id,
    }));
}

export function resolveSubmitPayload(
    input: string,
    agentOptions: MentionOption[],
) {
    return resolveMentionPayload(input, agentOptions);
}

export function insertMention(option: { label?: ReactNode }) {
    return `@${String(option.label ?? "")}`;
}

// --- 文件上传工具函数 ---

export type AttachedFile = {
    id: string;
    name: string;
    size: number;
    type: string;
    base64: string;
};

export type UploadFileLike = File & {
    id: string;
    instance?: File;
    src?: string;
    url?: string;
    [key: string]: unknown;
};

export function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1] ?? "";
            resolve(base64);
        };
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsDataURL(file);
    });
}

export function resolveAttachedFileChanges(
    currentFiles: AttachedFile[],
    nextFiles: UploadFileLike[],
    changedFiles: UploadFileLike[],
) {
    const removedIds = currentFiles
        .filter((file) => !nextFiles.some((nextFile) => nextFile.id === file.id))
        .map((file) => file.id);

    const addedFiles = changedFiles.filter(
        (file) => !currentFiles.some((currentFile) => currentFile.id === file.id),
    );

    return {
        addedFiles,
        removedIds,
    };
}

export async function buildAttachedFiles(files: UploadFileLike[]) {
    return Promise.all(
        files.map(async (file) => {
            const instance = file.instance || file;
            const base64 = await readFileAsBase64(instance);

            return {
                id: file.id,
                name: file.name,
                size: file.size,
                type: file.type,
                base64,
            } satisfies AttachedFile;
        }),
    );
}

export function toAttachedFilesPayload(files: AttachedFile[]) {
    return files.map((file) => ({
        name: file.name,
        base64: file.base64,
        type: file.type,
    }));
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
