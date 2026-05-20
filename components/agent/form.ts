import type { Agent } from "@prisma/client";
import type { ReactNode } from "react";

export type AgentPermission = "websearch" | "docs";
export type AgentSkill = string;

export const required = {
    validator: (value: unknown) => !!value,
    message: "",
};

export type AgentFormValues = {
    name: string;
    desc?: string;
    model_id: string;
    skills: AgentSkill[];
    permissions: AgentPermission[];
    routable: string[];
    "meta.color"?: string;
    mcp_servers: string[];
};

export const WEEK_DAY_OPTIONS = [
    { label: "周一", value: "1" },
    { label: "周二", value: "2" },
    { label: "周三", value: "3" },
    { label: "周四", value: "4" },
    { label: "周五", value: "5" },
    { label: "周六", value: "6" },
    { label: "周日", value: "7" },
];

export function createScheduleCron(schedule: { time: string; days: string[] }): string {
    const [hour, minute] = schedule.time.split(":").map(Number);
    const dayPart = schedule.days.length ? schedule.days.join(",") : "*";
    return `${minute} ${hour} * * ${dayPart}`;
}

export function getAgentFormValues(agent?: Agent): AgentFormValues {
    const meta = agent?.meta as Record<string, unknown> | undefined;
    const mcpServers = meta?.mcp_servers;

    return {
        name: agent?.name ?? "",
        desc: agent?.desc ?? "",
        model_id: agent ? String(agent.modelId) : "",
        skills: Array.isArray(agent?.skills)
            ? agent.skills.filter(
                  (item): item is AgentSkill => typeof item === "string",
              )
            : [],
        permissions: Array.isArray(agent?.permissions)
            ? agent.permissions.filter(
                  (item): item is AgentPermission =>
                      item === "websearch" || item === "docs",
              )
            : [],
        routable: agent?.routable !== false ? ["true"] : [],
        "meta.color":
            (agent?.meta as { color?: string })?.color ?? "transparent",
        mcp_servers: Array.isArray(mcpServers)
            ? mcpServers.filter(
                  (s): s is string => typeof s === "string",
              )
            : [],
    };
}

export function createAgentMentionOptions(
    agents: Array<{
        id: number;
        name: string;
    }>,
) {
    return agents.map((agent) => ({
        label: agent.name,
        value: String(agent.id),
    }));
}

export function insertAgentMention(option: { label?: ReactNode }) {
    return `@${String(option.label ?? "")}`;
}
