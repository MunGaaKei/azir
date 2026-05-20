import vike from "@vikejs/hono";
import dotenv from "dotenv";
import { Hono } from "hono";

dotenv.config({
    path: ".env",
    override: true,
});

import agentApp from "./agent";
import chatApp from "./chat";
import docsApp from "./docs";
import mcpApp from "./mcp";
import mcpRemoteApp from "./mcp/remote";
import memoriesApp from "./memories";
import modelApp from "./model";
import skillsApp from "./skills/remote";
import { ensureUidMiddleware, default as uidApp } from "./uid";

export function createApp() {
    const app = new Hono();

    // Ensure azir-uid cookie on every request
    app.use("*", ensureUidMiddleware);

    app.route("/api/agent", agentApp);
    app.route("/api/chat", chatApp);
    app.route("/api/docs", docsApp);
    app.route("/api/model", modelApp);
    app.route("/api/uid", uidApp);
    app.route("/api/mcp", mcpApp);
    app.route("/api/mcp", mcpRemoteApp);
    app.route("/api/memories", memoriesApp);
    app.route("/api/skills", skillsApp);
    vike(app, []);

    return app;
}
