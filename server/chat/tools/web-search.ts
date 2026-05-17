import { tryto } from "@/utils";
import { tool } from "@openai/agents";
import { z } from "zod";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

type TavilyResult = {
	title?: string;
	url?: string;
	content?: string;
	score?: number;
};

type TavilyResponse = {
	answer?: string;
	results?: TavilyResult[];
};

export const tavilyWebSearchTool = tool({
	name: "web_search",
	description:
		"搜索互联网的最新信息、新闻和网页内容。适合处理依赖实时数据、近期事件、外部站点资料的问题。",
	parameters: z
		.object({
			query: z.string().min(1).describe("要搜索的关键词或问题"),
			topic: z
				.enum(["general", "news", "finance"])
				.optional()
				.describe("搜索主题，新闻或金融问题可指定更合适的主题"),
			maxResults: z
				.number()
				.int()
				.min(1)
				.max(10)
				.optional()
				.describe("返回的来源数量，默认 5"),
		})
		.strict(),
	async execute(input) {
		if (!TAVILY_API_KEY) return "联网搜索工具未配置：缺少 TAVILY_API_KEY。";

		const query = input.query.trim();
		if (!query) return "搜索工具调用失败：query 不能为空。";

		const { data: response, error } = await tryto(
			fetch(TAVILY_SEARCH_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${TAVILY_API_KEY}`,
				},
				body: JSON.stringify({
					query,
					topic: input.topic ?? "general",
					search_depth: "basic",
					max_results: input.maxResults ?? 5,
					include_answer: "basic",
				}),
			}),
		);

		if (error) throw error;
		if (!response?.ok) throw new Error(`搜索失败（${response?.status ?? "无响应"}）`);

		const data = (await response.json()) as TavilyResponse;
		const results = data.results ?? [];
		const lines = [`查询: ${query}`];

		if (typeof data.answer === "string" && data.answer.trim()) {
			lines.push(`摘要: ${data.answer.trim()}`);
		}

		if (!results.length) {
			lines.push("来源: 未找到相关结果。");
			return lines.join("\n\n");
		}

		lines.push("来源:");
		for (const [index, result] of results.entries()) {
			lines.push(
				`${index + 1}. ${result.title || "无标题"}\nURL: ${result.url || "无 URL"}\n内容: ${result.content || "无摘要"}`,
			);
		}

		return lines.join("\n\n");
	},
});
