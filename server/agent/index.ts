import { Hono } from "hono";
import { db } from "../db";

const api = new Hono();

function getAgentPayload(payload: Record<string, unknown>) {
    const name = String(payload.name ?? "").trim();
    const modelId = Number(payload.model_id);
    const desc =
        typeof payload.desc === "string" && payload.desc.trim()
            ? payload.desc.trim()
            : null;

    return {
        name,
        desc,
        modelId,
    };
}

api.get("/", async (c) => {
    const agents = await db.agent.findMany({
        include: {
            model: true,
        },
        orderBy: {
            id: "asc",
        },
    });

    return c.json(agents);
});

api.post("/", async (c) => {
    const payload = (await c.req.json()) as Record<string, unknown>;
    const { name, desc, modelId } = getAgentPayload(payload);

    if (!name) {
        return c.json({ message: "Agent 名称不能为空" }, 400);
    }

    if (Number.isNaN(modelId)) {
        return c.json({ message: "模型 ID 无效" }, 400);
    }

    const agent = await db.agent.create({
        data: {
            name,
            desc,
            model_id: modelId,
        },
        include: {
            model: true,
        },
    });

    return c.json(agent);
});

api.put("/:id", async (c) => {
    const id = Number(c.req.param("id"));

    if (Number.isNaN(id)) {
        return c.json({ message: "Invalid agent id" }, 400);
    }

    const payload = (await c.req.json()) as Record<string, unknown>;
    const { name, desc, modelId } = getAgentPayload(payload);

    if (!name) {
        return c.json({ message: "Agent 名称不能为空" }, 400);
    }

    if (Number.isNaN(modelId)) {
        return c.json({ message: "模型 ID 无效" }, 400);
    }

    const agent = await db.agent.update({
        where: {
            id,
        },
        data: {
            name,
            desc,
            model_id: modelId,
        },
        include: {
            model: true,
        },
    });

    return c.json(agent);
});

export default api;
