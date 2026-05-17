import { Hono } from "hono";
import { getUid } from "../uid";
import { db } from "../db";

const api = new Hono();

api.get("/", async (c) => {
	const uid = getUid(c);
	const models = await db.model.findMany({
		where: { uid },
		orderBy: {
			id: "asc",
		},
	});

	return c.json(models);
});

api.post("/", async (c) => {
	const uid = getUid(c);
	const { name, apiUrl, apiKey } = await c.req.json();

	const model = await db.model.create({
		data: {
			name,
			apiUrl,
			apiKey,
			uid,
		},
	});

	return c.json(model);
});

api.put("/:id", async (c) => {
	const uid = getUid(c);
	const id = Number(c.req.param("id"));

	if (Number.isNaN(id)) {
		return c.json({ message: "Invalid model id" }, 400);
	}

	const { name, apiUrl, apiKey } = await c.req.json();

	const model = await db.model.update({
		where: {
			id,
			uid,
		},
		data: {
			name,
			apiUrl,
			apiKey,
		},
	});

	return c.json(model);
});

api.delete("/:id", async (c) => {
    const uid = getUid(c);
    const id = Number(c.req.param("id"));

    if (Number.isNaN(id)) {
        return c.json({ message: "Invalid model id" }, 400);
    }

    const model = await db.model.findFirst({ where: { id, uid } });
    if (!model) {
        return c.json({ message: "Model not found" }, 404);
    }

    await db.model.delete({ where: { id } });
    return c.json({ message: "ok" });
});

export default api;
