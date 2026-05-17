import { Hono } from "hono";
import type { Context } from "hono";
import { getUid } from "./uid";
import { FileSession } from "./chat/memories/file-session";

const api = new Hono();

api.delete("/", async (c: Context) => {
    const uid = getUid(c);
    if (!uid) {
        return c.json({ message: "UID 不存在" }, 400);
    }

    const session = new FileSession(uid);
    await session.clearSession();

    return c.json({ message: "记忆已清空" });
});

export default api;
