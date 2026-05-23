import { tool } from "@openai/agents";
import { z } from "zod";
import { getCurrentDateContext } from "../prompt";

export const currentTimeTool = tool({
	name: "current_time",
	description:
		"获取服务器当前日期、时间、星期和时区信息。适合回答今天几号、现在几点、今天星期几等问题。",
	parameters: z.object({}).strict(),
	async execute() {
		return getCurrentDateContext();
	},
});
