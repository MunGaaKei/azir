import vike from "@vikejs/hono";
import { Hono } from "hono";
import agentApp from "./agent";
import modelApp from "./model";

function getApp() {
    const app = new Hono();

    app.route("/api/agent", agentApp);
    app.route("/api/model", modelApp);
    vike(app, []);

    return app;
}

export const app = getApp();
