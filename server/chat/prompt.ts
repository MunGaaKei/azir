export type ChatUploadFile = {
    name: string;
    base64: string;
    type: string;
};

const QUIET_EXECUTION =
    "安静执行，不汇报过程、不描述工具调用、不输出中间步骤，直接输出最终结果。";

const HISTORY_USAGE_INSTRUCTION =
    "仅在历史消息与当前问题直接相关时才参考；如果无关，忽略历史消息，只回答当前问题。";

export function buildUserPrompt(prompt: string, files: ChatUploadFile[]) {
    const normalizedPrompt = prompt.trim();
    if (normalizedPrompt) {
        return `${normalizedPrompt}\n\n补充要求：${QUIET_EXECUTION} ${HISTORY_USAGE_INSTRUCTION}`;
    }

    if (files.length > 0) {
        return `先查看用户上传的文件，再给出简洁、准确的回答。${QUIET_EXECUTION} ${HISTORY_USAGE_INSTRUCTION}`;
    }

    return `不要有多余的语气词，必须以精准、简洁的回答用户的问题。${QUIET_EXECUTION} ${HISTORY_USAGE_INSTRUCTION}`;
}

// ---- Date/time context (merged from time.ts) ----

export function getCurrentDateInfo() {
    const now = new Date();
    const localDateTime = new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        weekday: "long",
        timeZoneName: "short",
    }).format(now);

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return {
        now,
        year,
        month,
        day,
        isoDate: `${year}-${month}-${day}`,
        localDateTime,
    };
}

export function getCurrentDateContext() {
    const { localDateTime } = getCurrentDateInfo();

    return [
        `当前服务器本地时间: ${localDateTime}`,
        "当明确要求有今天、当前时间、当前日期、最新、星期几等问题时，必须以这里提供的当前时间为准。",
    ].join("\n");
}
