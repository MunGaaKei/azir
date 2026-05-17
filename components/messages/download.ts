import { tryto } from "@/utils";
import { Message } from "@ioca/react";

export type DownloadableFile = {
    filename: string;
    mime: string;
    base64: string;
};

const FILE_BLOCK_RE = /```azir-file[\s\S]*?```/g;
const FILE_META_RE = /filename:\s*([^\r\n]+)[\s\S]*?base64:\s*([\s\S]+?)```/i;

function triggerDownload(params: { blob: Blob; filename: string }) {
    const url = URL.createObjectURL(params.blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = params.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function triggerDownloadFromBase64(
    base64: string,
    filename: string,
    mime: string,
) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    triggerDownload({ blob, filename });
}

function parseFileBlock(block: string): DownloadableFile | null {
    const match = block.match(FILE_META_RE);
    if (!match) return null;

    const filename = match[1].trim();
    let base64 = match[2].replace(/\s/g, "");
    const tagIndex = base64.indexOf("<");
    if (tagIndex >= 0) base64 = base64.slice(0, tagIndex);

    if (!filename || !base64) return null;
    return { filename, mime: "application/octet-stream", base64 };
}

export function extractDownloadableFiles(content: string) {
    const files: DownloadableFile[] = [];
    const markdown = content
        .replace(FILE_BLOCK_RE, (match: string) => {
            const file = parseFileBlock(match);
            if (file) {
                files.push(file);
            }

            return "";
        })
        .trim();

    return {
        markdown,
        files,
    };
}

export async function downloadTextFile(params: {
    content: string;
    filename: string;
    mime: string;
    onError?: () => void;
}) {
    const { error } = await tryto(
        Promise.resolve().then(() => {
            triggerDownload({
                blob: new Blob([params.content], { type: params.mime }),
                filename: params.filename,
            });
        }),
    );

    if (error) {
        params.onError?.();
    }
}

export async function downloadFile(file: DownloadableFile) {
    const { error } = await tryto(
        Promise.resolve().then(() => {
            triggerDownloadFromBase64(
                file.base64,
                file.filename,
                file.mime || "application/octet-stream",
            );
        }),
    );

    if (error) {
        Message.error("文件内容无效，无法下载");
    }
}
