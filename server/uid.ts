import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { db } from "./db";

const COOKIE_NAME = "azir-uid";
const MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateUid(): string {
    let result = "";
    for (let i = 0; i < 16; i++) {
        result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    return result;
}

export function getUid(c: Context): string {
    return (c.get("uid") as string) || "";
}

export async function ensureUidMiddleware(
    c: Context,
    next: () => Promise<void>,
) {
    let uid = getCookie(c, COOKIE_NAME);
    const isNew = !uid;

    if (isNew) {
        uid = generateUid();
    }

    c.set("uid", uid);

    await next();

    // After handler runs, append Set-Cookie if uid was freshly generated
    if (isNew && c.res) {
        setCookie(c, COOKIE_NAME, uid!, {
            httpOnly: true,
            path: "/",
            maxAge: MAX_AGE,
            sameSite: "Lax",
        });
    }
}

export function setUidCookie(c: Context, uid: string) {
    setCookie(c, COOKIE_NAME, uid, {
        httpOnly: true,
        path: "/",
        maxAge: MAX_AGE,
        sameSite: "Lax",
    });
    // Also set in context for subsequent middleware/handlers
    c.set("uid", uid);
}

const api = new Hono();

api.get("/", (c) => {
    const uid = getUid(c);
    return c.json({ uid });
});

api.put("/", async (c) => {
    const oldUid = getUid(c);
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const newUid =
        typeof body.uid === "string" && body.uid.length > 0
            ? body.uid.trim()
            : "";

    if (!newUid) {
        return c.json({ message: "UID 不能为空" }, 400);
    }

    const [agentCount, modelCount] = await Promise.all([
        db.agent.count({ where: { uid: newUid } }),
        db.model.count({ where: { uid: newUid } }),
    ]);

    if (agentCount === 0 && modelCount === 0) {
        return c.json({ message: "该 UID 不存在" }, 400);
    }

    if (newUid !== oldUid) {
        await db.$transaction([
            db.agent.updateMany({
                where: { uid: oldUid },
                data: { uid: newUid },
            }),
            db.model.updateMany({
                where: { uid: oldUid },
                data: { uid: newUid },
            }),
        ]);
    }

    setUidCookie(c, newUid);

    return c.json({ uid: newUid });
});

export default api;
