import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import type { Session } from "@openai/agents";
import type { AgentInputItem } from "@openai/agents";

function cloneAgentItem(item: AgentInputItem): AgentInputItem {
    return structuredClone(item);
}

export class FileSession implements Session {
    private sessionId: string;
    private filePath: string;
    private items: AgentInputItem[] = [];
    private loaded = false;

    constructor(uid: string, namespace?: string) {
        this.sessionId = namespace ? `${uid}-${namespace}` : uid;
        const baseDir = process.env.AZIR_SESSION_DIR || join(tmpdir(), "azir-sessions");
        this.filePath = join(baseDir, uid, namespace ? `${namespace}.json` : "default.json");
    }

    async getSessionId(): Promise<string> {
        return this.sessionId;
    }

    async getItems(limit?: number): Promise<AgentInputItem[]> {
        await this.ensureLoaded();
        if (limit === undefined) {
            return this.items.map(cloneAgentItem);
        }
        if (limit <= 0) {
            return [];
        }
        const start = Math.max(this.items.length - limit, 0);
        return this.items.slice(start).map(cloneAgentItem);
    }

    async addItems(items: AgentInputItem[]): Promise<void> {
        if (items.length === 0) {
            return;
        }
        await this.ensureLoaded();
        const cloned = items.map(cloneAgentItem);
        this.items = [...this.items, ...cloned];
        await this.persist();
    }

    async popItem(): Promise<AgentInputItem | undefined> {
        await this.ensureLoaded();
        if (this.items.length === 0) {
            return undefined;
        }
        const item = this.items[this.items.length - 1];
        this.items = this.items.slice(0, -1);
        await this.persist();
        return cloneAgentItem(item);
    }

    async clearSession(): Promise<void> {
        this.items = [];
        await this.persist();
    }

    private async ensureLoaded(): Promise<void> {
        if (this.loaded) return;
        if (existsSync(this.filePath)) {
            const content = await readFile(this.filePath, "utf-8");
            this.items = JSON.parse(content) as AgentInputItem[];
        }
        this.loaded = true;
    }

    private async persist(): Promise<void> {
        const dir = dirname(this.filePath);
        if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true });
        }
        await writeFile(this.filePath, JSON.stringify(this.items), "utf-8");
    }
}
