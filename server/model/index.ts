import { Hono } from "hono";
import { db } from "../db";

const api = new Hono();

api.get("/", async (c) => {
    const models = await db.model.findMany({
        orderBy: {
            id: "asc",
        },
    });

    return c.json(models);
});

api.post("/", async (c) => {
    const { name, api_url, api_key } = await c.req.json();

    const model = await db.model.create({
        data: {
            name,
            api_url,
            api_key,
        },
    });

    return c.json(model);
});

api.put("/:id", async (c) => {
    const id = Number(c.req.param("id"));

    if (Number.isNaN(id)) {
        return c.json({ message: "Invalid model id" }, 400);
    }

    const { name, api_url, api_key } = await c.req.json();

    const model = await db.model.update({
        where: {
            id,
        },
        data: {
            name,
            api_url,
            api_key,
        },
    });

    return c.json(model);
});

export default api;
