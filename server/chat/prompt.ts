export type ChatUploadFile = {
	name: string;
	base64: string;
	type: string;
};

const HISTORY_USAGE_INSTRUCTION =
	"仅在历史消息与当前问题直接相关时才参考；如果无关，忽略历史消息，只回答当前问题。";

export function buildUserPrompt(prompt: string, files: ChatUploadFile[]) {
	const normalizedPrompt = prompt.trim();
	if (normalizedPrompt) {
		return `${normalizedPrompt}\n\n补充要求：${HISTORY_USAGE_INSTRUCTION}`;
	}

	if (files.length > 0) {
		return `先查看用户上传的文件，再给出简洁、准确的回答。${HISTORY_USAGE_INSTRUCTION}`;
	}

	return `不要有多余的语气词，必须以精准、简洁的回答用户的问题。${HISTORY_USAGE_INSTRUCTION}`;
}
