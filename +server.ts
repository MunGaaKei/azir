import type { Server } from "vike/types";
import { createApp } from "./server/hono";
import { db } from "./server/db";

// https://vike.dev/server
export default {
    fetch: (...args) => createApp().fetch(...args),
} satisfies Server;

process.on("SIGINT", async () => {
    await db.$disconnect();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    await db.$disconnect();
    process.exit(0);
});
