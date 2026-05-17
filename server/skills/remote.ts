import { Hono } from "hono";
import { db } from "../db";
import { getUid } from "../uid";
import { fetchSkillFromGitHub, GitHubSkillError } from "./github";
import { invalidateSkillsCache } from "./index";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

function parseContent(content: string) {
    const match = content.match(FRONTMATTER_RE);
    if (!match) {
        return { name: "", description: "", body: content, rules: [] };
    }

    const attrs = Object.fromEntries(
        match[1]
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const idx = line.indexOf(":");
                if (idx === -1) return [line, ""];
                return [
                    line.slice(0, idx).trim(),
                    line
                        .slice(idx + 1)
                        .trim()
                        .replace(/^['"]|['"]$/g, ""),
                ];
            }),
    );

    const body = content.slice(match[0].length).trim();
    const name = (attrs.name || "").trim();
    const description = (attrs.description || "").trim();

    // Extract rules from ## Rules section with ### headings
    const rules: Array<{ name: string; content: string }> = [];
    const rulesSection = body.match(/##\s*规则[s]?\s*\n([\s\S]*?)$/);
    if (rulesSection) {
        const ruleBlocks = rulesSection[1].split(/(?=###\s)/);
        for (const block of ruleBlocks) {
            const ruleMatch = block.match(/###\s+(.+)\n([\s\S]*?)$/);
            if (ruleMatch) {
                const ruleName = ruleMatch[1].trim();
                const ruleContent = ruleMatch[2].trim().replace(/\r\n/g, "\n");
                if (ruleName) {
                    rules.push({ name: ruleName, content: ruleContent });
                }
            }
        }
    }

    return { name, description, body, rules };
}

const api = new Hono();

api.post("/remote", async (c) => {
    const uid = getUid(c);
    const body = (await c.req.json().catch(() => ({}))) as Record<
        string,
        unknown
    >;
    const repoUrl = String(body.repoUrl ?? "").trim();
    const content = String(body.content ?? "").trim();

    try {
        // Registry-based import (skill name → GitHub URL)
        const skillName = String(body.name ?? "").trim();
        if (!repoUrl && skillName) {
            // If the input contains "/", treat it as a direct GitHub path
            const resolvedRepoUrl = skillName.includes("/")
                ? skillName
                : `${(process.env.SKILLS_REGISTRY_BASE || "https://github.com/azir").replace(/\/$/, "")}/${skillName}`;

            const data = await fetchSkillFromGitHub(resolvedRepoUrl);

            const existing = await db.skill.findFirst({
                where: { uid, repoUrl: data.repoUrl },
            });
            if (existing) {
                return c.json(
                    { message: "该技能已导入", id: existing.id },
                    409,
                );
            }

            const skill = await db.skill.create({
                data: {
                    uid,
                    name: data.name,
                    description: data.description,
                    repoUrl: data.repoUrl,
                    skillMd: data.skillMd,
                    rules: JSON.parse(JSON.stringify(data.rules)),
                },
            });

            invalidateSkillsCache(uid);

            return c.json({
                id: skill.id,
                name: skill.name,
                description: skill.description,
                repoUrl: skill.repoUrl,
                rulesCount: (data.rules as Array<unknown>).length,
            });
        }

        // GitHub import mode (direct URL)
        if (repoUrl) {
            const data = await fetchSkillFromGitHub(repoUrl);

            const existing = await db.skill.findFirst({
                where: { uid, repoUrl: data.repoUrl },
            });
            if (existing) {
                return c.json(
                    { message: "该仓库已导入，请勿重复导入", id: existing.id },
                    409,
                );
            }

            const skill = await db.skill.create({
                data: {
                    uid,
                    name: data.name,
                    description: data.description,
                    repoUrl: data.repoUrl,
                    skillMd: data.skillMd,
                    rules: JSON.parse(JSON.stringify(data.rules)),
                },
            });

            invalidateSkillsCache(uid);

            return c.json({
                id: skill.id,
                name: skill.name,
                description: skill.description,
                repoUrl: skill.repoUrl,
                rulesCount: (data.rules as Array<unknown>).length,
            });
        }

        // Content-based creation (manual textarea)
        if (content) {
            const parsed = parseContent(content);
            const name = parsed.name || "未命名技能";
            const description = parsed.description;

            const skill = await db.skill.create({
                data: {
                    uid,
                    name,
                    description,
                    repoUrl: "",
                    skillMd: content,
                    rules: JSON.parse(JSON.stringify(parsed.rules)),
                },
            });

            invalidateSkillsCache(uid);

            return c.json({
                id: skill.id,
                name: skill.name,
                description: skill.description,
                repoUrl: "",
                rulesCount: parsed.rules.length,
            });
        }

        // Legacy field-based creation
        const name = String(body.name ?? "").trim();
        const description = String(body.description ?? "").trim();
        const skillMd = String(body.skillMd ?? "").trim();
        const rules = Array.isArray(body.rules) ? body.rules : [];

        if (!name) {
            return c.json({ message: "name 不能为空" }, 400);
        }

        const existing = await db.skill.findFirst({ where: { uid, name } });
        if (existing) {
            return c.json({ message: "同名技能已存在" }, 409);
        }

        const skill = await db.skill.create({
            data: {
                uid,
                name,
                description,
                repoUrl: "",
                skillMd,
                rules: JSON.parse(JSON.stringify(rules)),
            },
        });

        invalidateSkillsCache(uid);

        return c.json({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            repoUrl: "",
            rulesCount: (rules as Array<unknown>).length,
        });
    } catch (error) {
        if (error instanceof GitHubSkillError) {
            return c.json({ message: error.message }, 400);
        }
        return c.json({ message: String(error) }, 500);
    }
});

api.put("/remote/:id", async (c) => {
    const uid = getUid(c);
    const id = Number(c.req.param("id"));

    if (Number.isNaN(id)) {
        return c.json({ message: "无效的 ID" }, 400);
    }

    const body = (await c.req.json().catch(() => ({}))) as Record<
        string,
        unknown
    >;

    const existing = await db.skill.findFirst({ where: { id, uid } });
    if (!existing) {
        return c.json({ message: "未找到该技能" }, 404);
    }

    const data: Record<string, unknown> = {};

    if (typeof body.content === "string" && body.content.trim()) {
        const parsed = parseContent(body.content.trim());
        if (parsed.name) data.name = parsed.name;
        if (parsed.description) data.description = parsed.description;
        data.skillMd = body.content.trim();
        data.rules = JSON.parse(JSON.stringify(parsed.rules));
    } else {
        if (typeof body.name === "string" && body.name.trim())
            data.name = body.name.trim();
        if (typeof body.description === "string")
            data.description = body.description.trim();
        if (typeof body.skillMd === "string")
            data.skillMd = body.skillMd.trim();
        if (Array.isArray(body.rules))
            data.rules = JSON.parse(JSON.stringify(body.rules));
        if (typeof body.repoUrl === "string")
            data.repoUrl = body.repoUrl.trim();
    }

    const skill = await db.skill.update({ where: { id }, data });

    invalidateSkillsCache(uid);

    return c.json({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        repoUrl: skill.repoUrl,
        rulesCount: (skill.rules as Array<unknown>).length,
    });
});

api.get("/remote", async (c) => {
    const uid = getUid(c);
    const skills = await db.skill.findMany({
        where: { uid },
        orderBy: { id: "asc" },
        select: {
            id: true,
            name: true,
            description: true,
            repoUrl: true,
            skillMd: true,
            rules: true,
            createdAt: true,
        },
    });

    return c.json(
        skills.map((s) => ({
            ...s,
            rulesCount: (s.rules as Array<unknown>).length,
        })),
    );
});

api.get("/remote/:id", async (c) => {
    const uid = getUid(c);
    const id = Number(c.req.param("id"));

    if (Number.isNaN(id)) {
        return c.json({ message: "无效的 ID" }, 400);
    }

    const skill = await db.skill.findFirst({ where: { id, uid } });
    if (!skill) {
        return c.json({ message: "未找到该技能" }, 404);
    }

    return c.json(skill);
});

api.delete("/remote/:id", async (c) => {
    const uid = getUid(c);
    const id = Number(c.req.param("id"));

    if (Number.isNaN(id)) {
        return c.json({ message: "无效的 ID" }, 400);
    }

    const skill = await db.skill.findFirst({ where: { id, uid } });
    if (!skill) {
        return c.json({ message: "未找到该技能" }, 404);
    }

    await db.skill.delete({ where: { id } });
    invalidateSkillsCache(uid);

    return c.json({ message: "已删除" });
});

export default api;
