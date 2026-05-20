import { db } from "../db";
import { resolveMcpServers, toErrorMessage } from "../chat/utils";
import { createAgent, createRunner } from "../chat/provider";
import { buildUserPrompt } from "../chat/prompt";
import { FileSession } from "../chat/memories/file-session";
import { getAgentById } from "../agent/store";
import type { AgentWithModel } from "../agent/store";
import type { Agent } from "@prisma/client";

function createCronExpression(schedule: {
    time: string;
    days: string[];
}): string {
    const [hour, minute] = schedule.time.split(":").map(Number);
    const dayPart = schedule.days.length ? schedule.days.join(",") : "*";
    return `${minute} ${hour} * * ${dayPart}`;
}

async function runScheduledAgent(
    agentConfig: AgentWithModel,
    prompt: string,
): Promise<string> {
    const mcpManager = await resolveMcpServers(agentConfig, agentConfig.uid);

    const agent = await createAgent(
        agentConfig,
        {},
        undefined,
        0,
        mcpManager?.active ?? [],
    );
    const runner = createRunner(agentConfig);
    const session = new FileSession(
        agentConfig.uid,
        `agent_${agentConfig.id}`,
    );

    let output = "";
    const result = await runner.run(
        agent,
        buildUserPrompt(prompt, []),
        { stream: true, session },
    );

    for await (const event of result.toStream()) {
        if (event.type === "raw_model_stream_event") {
            const delta = (event.data as { delta?: string }).delta;
            if (delta) output += delta;
        }
    }

    await result.completed;

    // Save to global session so frontend can see the output
    const globalSession = new FileSession(agentConfig.uid);
    await globalSession.addItems([
        {
            role: "user",
            content: [{ type: "input_text", text: `[定时任务] ${prompt}` }],
        } as never,
        {
            role: "assistant",
            content: [{ type: "output_text", text: output }],
        } as never,
    ]);

    if (mcpManager) {
        await mcpManager.close().catch(() => {});
    }

    return output;
}

async function disableSchedule(agentId: number) {
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) return;

    const meta = { ...(agent.meta as Record<string, unknown>) };
    const schedule = meta.schedule as Record<string, unknown> | undefined;
    if (schedule) {
        meta.schedule = { ...schedule, enabled: false };
        await db.agent.update({
            where: { id: agentId },
            data: { meta: meta as Record<string, string | boolean | number | null> },
        });
    }
}

// Lightweight cron scheduler — replaces node-cron (incompatible with Vercel ESM bundle)
interface CronTask {
    stop(): void;
}

function matchCronField(pattern: string, value: number): boolean {
    if (pattern === "*") return true;

    for (const part of pattern.split(",")) {
        const trimmed = part.trim();
        let step = 1;
        let rangeParts: string[];

        if (trimmed.includes("/")) {
            const [rangePart, stepStr] = trimmed.split("/");
            step = parseInt(stepStr, 10);
            if (Number.isNaN(step) || step < 1) continue;
            rangeParts = rangePart === "*" ? ["0", "59"] : rangePart.split("-");
        } else {
            rangeParts = trimmed.includes("-") ? trimmed.split("-") : [trimmed, trimmed];
        }

        if (rangeParts.length !== 2) continue;

        const start = parseInt(rangeParts[0], 10);
        const end = parseInt(rangeParts[1], 10);
        if (Number.isNaN(start) || Number.isNaN(end)) continue;

        if (value < start || value > end) continue;
        if ((value - start) % step === 0) return true;
    }
    return false;
}

function matchCron(expr: string, date: Date): boolean {
    const parts = expr.trim().split(/\s+/);
    if (parts.length < 5) return false;

    return (
        matchCronField(parts[0], date.getMinutes()) &&
        matchCronField(parts[1], date.getHours()) &&
        matchCronField(parts[2], date.getDate()) &&
        matchCronField(parts[3], date.getMonth() + 1) &&
        matchCronField(parts[4], date.getDay())
    );
}

function validateCron(expr: string): boolean {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return false;
    const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
    return parts.every((part, i) => {
        const [min, max] = ranges[i];
        return part.split(",").every((segment) => {
            const s = segment.trim();
            if (s === "*") return true;
            let startStr = s;
            let endStr = s;
            if (s.includes("/")) {
                const [rangePart, stepStr] = s.split("/");
                const step = parseInt(stepStr, 10);
                if (Number.isNaN(step) || step < 1) return false;
                if (rangePart === "*") return true;
                const rp = rangePart.split("-");
                if (rp.length !== 2) return false;
                startStr = rp[0];
                endStr = rp[1];
            } else if (s.includes("-")) {
                const rp = s.split("-");
                if (rp.length !== 2) return false;
                startStr = rp[0];
                endStr = rp[1];
            }
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            return !Number.isNaN(start) && !Number.isNaN(end) && start >= min && start <= max && end >= min && end <= max;
        });
    });
}

function scheduleCron(expr: string, cb: () => void): CronTask {
    let running = true;

    // Check every second, fire on the second when cron matches (node-cron compatible)
    const interval = setInterval(() => {
        if (!running) return;
        if (matchCron(expr, new Date())) {
            cb();
        }
    }, 1000);

    return {
        stop() {
            running = false;
            clearInterval(interval);
        },
    };
}

export class SchedulerService {
    private jobs = new Map<number, CronTask>();
    private timeouts = new Map<number, NodeJS.Timeout>();
    private running = new Set<number>();

    async start() {
        const agents = await db.agent.findMany({ include: { model: true } });

        for (const agent of agents) {
            const meta = agent.meta as Record<string, unknown> | undefined;
            const schedule = meta?.schedule as
                | { enabled?: boolean; time?: string; days?: string[]; prompt?: string }
                | undefined;

            if (schedule?.enabled) {
                await this.scheduleAgent(agent.id).catch(() => {});
            }
        }
    }

    async scheduleAgent(agentId: number) {
        this.unscheduleAgent(agentId);

        const agent = await db.agent.findUnique({
            where: { id: agentId },
            include: { model: true },
        });

        if (!agent) return;

        const meta = agent.meta as Record<string, unknown> | undefined;
        const schedule = meta?.schedule as
            | { enabled?: boolean; time?: string; days?: string[]; prompt?: string }
            | undefined;

        if (!schedule?.enabled || !schedule.time) return;

        const days = schedule.days ?? [];
        const isOneTime = days.length === 0;

        if (isOneTime) {
            await this.scheduleOneTime(agent, schedule as { time: string; prompt?: string });
        } else {
            await this.scheduleRecurring(agent, schedule as { time: string; days: string[]; prompt?: string });
        }
    }

    private async scheduleOneTime(
        agent: Agent,
        schedule: { time: string; prompt?: string },
    ) {
        const [hour, minute] = schedule.time.split(":").map(Number);
        const now = new Date();
        const nextRun = new Date(now);
        nextRun.setHours(hour, minute, 0, 0);

        // Time already passed today → expired
        if (nextRun <= now) {
            await disableSchedule(agent.id);
            return;
        }

        const delay = nextRun.getTime() - now.getTime();
        const timeout = setTimeout(async () => {
            console.log(`[Schedule] One-time agent ${agent.id} executing at ${new Date().toISOString()}`);
            const fullAgent = await getAgentById(agent.id, agent.uid);
            if (!fullAgent) {
                this.timeouts.delete(agent.id);
                this.running.delete(agent.id);
                await disableSchedule(agent.id);
                return;
            }

            try {
                await runScheduledAgent(
                    fullAgent,
                    schedule.prompt?.trim() || `请执行定时任务：${fullAgent.name}`,
                );
            } catch (error) {
                console.error(
                    `Scheduled agent ${agent.id} failed:`,
                    toErrorMessage(error),
                );
            } finally {
                this.timeouts.delete(agent.id);
                this.running.delete(agent.id);
                await disableSchedule(agent.id);
            }
        }, delay);

        this.timeouts.set(agent.id, timeout);
    }

    private async scheduleRecurring(
        agent: Agent,
        schedule: { time: string; days: string[]; prompt?: string },
    ) {
        const cronExpr = createCronExpression({
            time: schedule.time,
            days: schedule.days,
        });

        if (!validateCron(cronExpr)) return;

        const agentId = agent.id;
        const job = scheduleCron(cronExpr, async () => {
            console.log(`[Schedule] Recurring agent ${agentId} executing at ${new Date().toISOString()}`);
            if (this.running.has(agentId)) return;
            this.running.add(agentId);

            try {
                const fullAgent = await getAgentById(agentId, agent.uid);
                if (!fullAgent) {
                    this.running.delete(agentId);
                    return;
                }

                await runScheduledAgent(
                    fullAgent,
                    (schedule.prompt?.trim() || `请执行定时任务：${fullAgent.name}`) as string,
                );
            } catch (error) {
                console.error(
                    `Scheduled agent ${agentId} failed:`,
                    toErrorMessage(error),
                );
            } finally {
                this.running.delete(agentId);
            }
        });

        this.jobs.set(agentId, job);
    }

    unscheduleAgent(agentId: number) {
        const job = this.jobs.get(agentId);
        if (job) {
            job.stop();
            this.jobs.delete(agentId);
        }

        const timeout = this.timeouts.get(agentId);
        if (timeout) {
            clearTimeout(timeout);
            this.timeouts.delete(agentId);
        }
    }

    stop() {
        for (const job of this.jobs.values()) {
            job.stop();
        }
        for (const timeout of this.timeouts.values()) {
            clearTimeout(timeout);
        }
        this.jobs.clear();
        this.timeouts.clear();
        this.running.clear();
    }
}

export const schedulerService = new SchedulerService();
