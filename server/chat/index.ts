import { Context, Hono } from "hono";
import { getUid } from "../uid";
import { createChatResponse } from "./runner";

const api = new Hono();

api.post("/", chat);

async function chat(c: Context) {
	const uid = getUid(c);
	const body = (await c.req.json()) as {
		prompt?: string;
		agentIds?: number[];
		requestId?: string;
		files?: Array<{
			name: string;
			base64: string;
			type: string;
		}>;
	};

	return createChatResponse(body, uid);
}

export default api;
