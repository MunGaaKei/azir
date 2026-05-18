import { Hono } from "hono";
import { db } from "../db";
import { getUid } from "../uid";
import { invalidateMcpCache } from "./index";

const api = new Hono();

api.post("/remote", async (c) => {
    const uid = getUid(c);
    const body = (await c.req.json().catch(() => ({}))) as Record<
        string,
        unknown
    >;

    const name = String(body.name ?? "").trim();
    if (!name) {
        return c.json({ message: "name 不能为空" }, 400);
    }

    const existing = await (db as any).mcp.findFirst({
        where: { uid, name },
    });
    if (existing) {
        return c.json({ message: "同名 MCP 服务已存在" }, 409);
    }

    const config =
        body.config && typeof body.config === "object"
            ? body.config
            : {};
    const description = String(body.description ?? "").trim();

    const record = await (db as any).mcp.create({
        data: {
            uid,
            name,
            description,
            config: JSON.parse(JSON.stringify(config)),
        },
    });

    invalidateMcpCache(uid);

    return c.json({
        id: record.id,
        name: record.name,
        description: record.description,
        config: record.config,
    });
});

api.put("/remote/:id", async (c) => {
    const uid = getUid(c);
    const recordId = Number(c.req.param("id"));

    if (Number.isNaN(recordId)) {
        return c.json({ message: "无效的 ID" }, 400);
    }

    const body = (await c.req.json().catch(() => ({}))) as Record<
        string,
        unknown
    >;

    const existing = await (db as any).mcp.findFirst({
        where: { id: recordId, uid },
    });
    if (!existing) {
        return c.json({ message: "未找到该 MCP 服务" }, 404);
    }

    const data: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) {
        const name = body.name.trim();
        // Check name uniqueness excluding current record
        const conflict = await (db as any).mcp.findFirst({
            where: { uid, name, id: { not: recordId } },
        });
        if (conflict) {
            return c.json({ message: "同名 MCP 服务已存在" }, 409);
        }
        data.name = name;
    }
    if (typeof body.description === "string") {
        data.description = body.description.trim();
    }
    if (body.config && typeof body.config === "object") {
        data.config = JSON.parse(JSON.stringify(body.config));
    }

    const record = await (db as any).mcp.update({ where: { id: recordId }, data });

    invalidateMcpCache(uid);

    return c.json({
        id: record.id,
        name: record.name,
        description: record.description,
        config: record.config,
    });
});

api.get("/remote", async (c) => {
    const uid = getUid(c);
    const records = await (db as any).mcp.findMany({
        where: { uid },
        orderBy: { id: "asc" },
        select: {
            id: true,
            name: true,
            description: true,
            config: true,
            createdAt: true,
        },
    });

    return c.json(records);
});

api.get("/remote/:id", async (c) => {
    const uid = getUid(c);
    const id = Number(c.req.param("id"));

    if (Number.isNaN(id)) {
        return c.json({ message: "无效的 ID" }, 400);
    }

    const record = await (db as any).mcp.findFirst({
        where: { id, uid },
    });
    if (!record) {
        return c.json({ message: "未找到该 MCP 服务" }, 404);
    }

    return c.json(record);
});

api.delete("/remote/:id", async (c) => {
    const uid = getUid(c);
    const id = Number(c.req.param("id"));

    if (Number.isNaN(id)) {
        return c.json({ message: "无效的 ID" }, 400);
    }

    const record = await (db as any).mcp.findFirst({
        where: { id, uid },
    });
    if (!record) {
        return c.json({ message: "未找到该 MCP 服务" }, 404);
    }

    await (db as any).mcp.delete({ where: { id } });
    invalidateMcpCache(uid);

    return c.json({ message: "已删除" });
});

export default api;
