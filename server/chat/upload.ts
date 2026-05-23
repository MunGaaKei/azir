import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ChatUploadFile } from "./prompt";
import {
    setUploadedFiles,
    type UploadedFileInfo,
} from "./tools/file-reader";
import { sanitizeFilename } from "./utils";

export async function prepareUploadedFiles(
    requestId: string,
    files: ChatUploadFile[],
) {
    if (files.length === 0) {
        setUploadedFiles(requestId, []);
        return;
    }

    const dir = await mkdtemp(path.join(tmpdir(), `azir-${requestId}-`));
    const uploadedFiles = await Promise.all(
        files.map(async (file, index) => {
            const filename = sanitizeFilename(file.name, index);
            const filepath = path.join(dir, `${index}-${filename}`);
            const buffer = Buffer.from(file.base64, "base64");

            await writeFile(filepath, buffer);

            return {
                filename,
                filepath,
                type: file.type || "application/octet-stream",
                size: buffer.byteLength,
            } satisfies UploadedFileInfo;
        }),
    );

    setUploadedFiles(requestId, uploadedFiles);
}
