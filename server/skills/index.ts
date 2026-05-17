import { tool } from "@openai/agents";
import { z } from "zod";
import { db } from "../db";

type SkillRule = {
    name: string;
    content: string;
};

type LoadedSkill = {
    name: string;
    description: string;
    toolName: string;
    skillDoc: string;
    rules: SkillRule[];
};

export type SkillSummary = {
    name: string;
    description: string;
};

function toToolName(skillName: string) {
    return `skill_${skillName
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase()}`;
}

function scoreRule(rule: SkillRule, topic: string) {
    const normalizedTopic = topic.trim().toLowerCase();
    if (!normalizedTopic) {
        return 0;
    }

    const topicTokens = normalizedTopic
        .split(/[^a-z0-9]+/i)
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length >= 2);

    const haystack = `${rule.name}\n${rule.content}`.toLowerCase();
    let score = 0;

    if (haystack.includes(normalizedTopic)) {
        score += 10;
    }

    for (const token of topicTokens) {
        if (rule.name.toLowerCase().includes(token)) {
            score += 4;
        }
        if (haystack.includes(token)) {
            score += 1;
        }
    }

    return score;
}

const skillsPromises = new Map<string, Promise<Map<string, LoadedSkill>>>();

async function loadSkills(uid: string) {
    const skills = new Map<string, LoadedSkill>();

    try {
        const remoteSkills = await (db as any).skill.findMany({
            where: { uid },
        });
        for (const rs of remoteSkills) {
            const rules =
                (rs.rules as { name: string; content: string }[]) || [];
            skills.set(rs.name, {
                name: rs.name,
                description: rs.description,
                toolName: toToolName(rs.name),
                skillDoc: rs.skillMd,
                rules,
            });
        }
    } catch {
        // DB might not be available
    }

    return skills;
}

function getSkillsMap(uid: string): Promise<Map<string, LoadedSkill>> {
    if (!skillsPromises.has(uid)) {
        skillsPromises.set(uid, loadSkills(uid));
    }
    return skillsPromises.get(uid)!;
}

export function invalidateSkillsCache(uid: string) {
    skillsPromises.delete(uid);
}

export async function listAvailableSkills(
    uid: string,
): Promise<SkillSummary[]> {
    const skills = await getSkillsMap(uid);

    return Array.from(skills.values()).map((skill) => ({
        name: skill.name,
        description: skill.description,
    }));
}

export async function createAgentSkillTools(
    skillNames: string[],
    uid: string,
    requestId?: string,
) {
    const skills = await getSkillsMap(uid);

    return skillNames
        .map((skillName) => skills.get(skillName))
        .filter((skill): skill is LoadedSkill => !!skill)
        .map((skill) =>
            tool({
                name: skill.toolName,
                description: `${skill.description} 当前启用技能名: ${skill.name}`,
                parameters: z
                    .object({
                        topic: z
                            .string()
                            .trim()
                            .min(1)
                            .optional()
                            .describe("当前问题关注的主题、场景或关键词"),
                    })
                    .strict(),
                async execute(input) {
                    const topic = input.topic?.trim();

                    if (!topic) {
                        const ruleNames = skill.rules
                            .map((rule) => rule.name)
                            .join(", ");

                        return [
                            `技能: ${skill.name}`,
                            `描述: ${skill.description}`,
                            "技能文档:",
                            skill.skillDoc || "无文档内容。",
                            ruleNames
                                ? `可用规则: ${ruleNames}`
                                : "可用规则: 无",
                            "如需更具体内容，请用 topic 再调用一次该技能工具。",
                        ].join("\n\n");
                    }

                    const matches = skill.rules
                        .map((rule) => ({
                            rule,
                            score: scoreRule(rule, topic),
                        }))
                        .filter((item) => item.score > 0)
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 3)
                        .map((item) => item.rule);

                    if (!matches.length) {
                        return [
                            `技能: ${skill.name}`,
                            `描述: ${skill.description}`,
                            `未找到与 topic "${topic}" 高度匹配的规则。`,
                            "可先阅读技能文档总览：",
                            skill.skillDoc || "无文档内容。",
                        ].join("\n\n");
                    }

                    return [
                        `技能: ${skill.name}`,
                        `描述: ${skill.description}`,
                        `topic: ${topic}`,
                        ...matches.map(
                            (rule) => `规则 ${rule.name}:\n\n${rule.content}`,
                        ),
                    ].join("\n\n");
                },
            }),
        );
}
