import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOG_DIR = path.resolve(fileURLToPath(import.meta.url), "../../logs");

async function ensureDir() {
    await mkdir(LOG_DIR, { recursive: true }).catch(() => {});
}

export async function log(filename: string, message: string) {
    return;

    await ensureDir();
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}]: ${message}\n`;
    await appendFile(path.join(LOG_DIR, `${filename}.log`), line);
}
