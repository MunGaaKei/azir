import { Hono } from "hono";
import { getUid } from "../uid";
import { schedulerService } from "../schedule";
import { createAgent, listAgents, updateAgent } from "./store";
import { listAvailableSkills } from "../skills";

const api = new Hono();

function getAgentPermissions(value: unknown): Array<"websearch"> {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is "websearch" => item === "websearch");
}

async function getAgentSkills(value: unknown, uid: string) {
    if (!Array.isArray(value)) {
        return [];
    }

    const enabledSkills = new Set(
        (await listAvailableSkills(uid)).map((skill) => skill.name),
    );

    return value.filter(
        (item): item is string =>
            typeof item === "string" && enabledSkills.has(item),
    );
}

async function getAgentPayload(payload: Record<string, unknown>, uid: string) {
    const name = String(payload.name ?? "").trim();
    const modelId = Number(payload.model_id);
    const desc =
        typeof payload.desc === "string" && payload.desc.trim()
            ? payload.desc.trim()
            : null;
    const skills = await getAgentSkills(payload.skills, uid);
    const permissions = getAgentPermissions(payload.permissions);
    const routable = payload.routable !== false;
    const meta =
        typeof payload.meta === "object" && payload.meta !== null
            ? (payload.meta as Record<string, unknown>)
            : undefined;

    return {
        name,
        desc,
        modelId,
        skills,
        permissions,
        routable,
        meta,
    };
}

api.get("/", async (c) => {
    const uid = getUid(c);
    const agents = await listAgents(uid);

    return c.json(agents);
});

api.get("/skills", async (c) => {
    const uid = getUid(c);
    const skills = await listAvailableSkills(uid);

    return c.json(skills);
});

api.post("/", async (c) => {
    const uid = getUid(c);
    const payload = (await c.req.json()) as Record<string, unknown>;
    const { name, desc, modelId, skills, permissions, routable, meta } =
        await getAgentPayload(payload, uid);

    if (!name) {
        return c.json({ message: "Agent 名称不能为空" }, 400);
    }

    if (Number.isNaN(modelId)) {
        return c.json({ message: "模型 ID 无效" }, 400);
    }

    const agent = await createAgent({
        name,
        desc,
        modelId,
        skills,
        permissions,
        routable,
        meta,
        uid,
    });

    await schedulerService.scheduleAgent(agent.id);

    return c.json(agent);
});

api.put("/:id", async (c) => {
    const uid = getUid(c);
    const id = Number(c.req.param("id"));

    if (Number.isNaN(id)) {
        return c.json({ message: "Invalid agent id" }, 400);
    }

    const payload = (await c.req.json()) as Record<string, unknown>;
    const { name, desc, modelId, skills, permissions, routable, meta } =
        await getAgentPayload(payload, uid);

    if (!name) {
        return c.json({ message: "Agent 名称不能为空" }, 400);
    }

    if (Number.isNaN(modelId)) {
        return c.json({ message: "模型 ID 无效" }, 400);
    }

    const agent = await updateAgent(id, uid, {
        name,
        desc,
        modelId,
        skills,
        permissions,
        routable,
        meta,
    });

    await schedulerService.scheduleAgent(agent.id);

    return c.json(agent);
});

api.delete("/:id", async (c) => {
    const uid = getUid(c);
    const id = Number(c.req.param("id"));

    if (Number.isNaN(id)) {
        return c.json({ message: "Invalid agent id" }, 400);
    }

    const { getAgentById, deleteAgent } = await import("./store");
    const agent = await getAgentById(id, uid);
    if (!agent) {
        return c.json({ message: "Agent not found" }, 404);
    }

    schedulerService.unscheduleAgent(id);
    await deleteAgent(id);
    return c.json({ message: "ok" });
});

export default api;
