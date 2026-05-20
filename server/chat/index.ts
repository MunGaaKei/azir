import { Context, Hono } from "hono";
import { getUid } from "../uid";
import { createClient, createDefaultAgentConfig } from "./provider";
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
		chatMode?: boolean;
	};

	return createChatResponse(body, uid);
}

api.post("/prompt", promptHandler);

async function promptHandler(c: Context) {
	const { prompt } = (await c.req.json()) as { prompt: string };
	if (!prompt?.trim()) {
		return c.json({ message: "prompt is required" }, 400);
	}

	const agentConfig = createDefaultAgentConfig();
	const client = createClient(agentConfig);

	const completion = await client.chat.completions.create({
		model: agentConfig.model.name,
		messages: [{ role: "user", content: prompt }],
	});

	return c.json({
		content: completion.choices[0]?.message?.content ?? "",
	});
}

export default api;
