import type { Server } from "vike/types";
import { createApp } from "./server/hono";
import { db } from "./server/db";
import { schedulerService } from "./server/schedule";

// https://vike.dev/server
export default {
    fetch: (...args) => createApp().fetch(...args),
} satisfies Server;

schedulerService.start().catch((error) => {
    console.error("Failed to start scheduler service:", error);
});

process.on("SIGINT", async () => {
    schedulerService.stop();
    await db.$disconnect();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    schedulerService.stop();
    await db.$disconnect();
    process.exit(0);
});
