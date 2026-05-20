import cron, { type ScheduledTask } from "node-cron";
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

export class SchedulerService {
    private jobs = new Map<number, ScheduledTask>();
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

        if (!cron.validate(cronExpr)) return;

        const agentId = agent.id;
        const job = cron.schedule(cronExpr, async () => {
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
