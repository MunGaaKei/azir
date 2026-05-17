import type { Server } from "vike/types";
import { createApp } from "./server/hono";

// https://vike.dev/server
export default {
    fetch: (...args) => createApp().fetch(...args),
} satisfies Server;
