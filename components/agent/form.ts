import type { Agent } from "@prisma/client";
import type { ReactNode } from "react";

export type AgentPermission = "websearch";
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
};

export function getAgentFormValues(agent?: Agent): AgentFormValues {
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
                  (item): item is AgentPermission => item === "websearch",
              )
            : [],
        routable: agent?.routable !== false ? ["true"] : [],
        "meta.color":
            (agent?.meta as { color?: string })?.color ?? "transparent",
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
