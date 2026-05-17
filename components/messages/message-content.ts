import type { ChatMessage } from "@/stores/chat";
import { extractDownloadableFiles, type DownloadableFile } from "./download";

type MessageRenderData = {
    files: DownloadableFile[];
    isAssistant: boolean;
    markdown: string;
    streamContent: string;
    stopped: boolean;
};

function getAssistantDisplayContent(params: {
    content: string;
    files: DownloadableFile[];
    markdown: string;
    status: ChatMessage["status"];
}) {
    if (params.markdown) {
        return params.markdown;
    }

    if (params.files.length) {
        return "";
    }

    if (params.content) {
        return params.content;
    }

    if (params.status === "stopped") {
        return "";
    }

    if (params.status === "error") {
        return "请求失败，请稍后重试";
    }

    return "";
}

export function getMessageRenderData(message: ChatMessage): MessageRenderData {
    const isAssistant = message.role === "assistant";
    const { markdown, files } = isAssistant
        ? extractDownloadableFiles(message.content)
        : {
              markdown: message.content,
              files: [] as DownloadableFile[],
          };

    return {
        files,
        isAssistant,
        markdown,
        stopped: isAssistant && message.status === "stopped",
        streamContent: isAssistant
            ? getAssistantDisplayContent({
                  content: message.content,
                  files,
                  markdown,
                  status: message.status,
              })
            : markdown,
    };
}
