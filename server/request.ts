import { tryto } from "@/utils";
import { Message } from "@ioca/react";

type RequestOptions = Omit<RequestInit, "body"> & {
    body?: BodyInit | Record<string, unknown>;
};

class RequestError extends Error {}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Object.prototype.toString.call(value) === "[object Object]";
}

function getRequestBody(body?: RequestOptions["body"]) {
    if (body === undefined) {
        return undefined;
    }

    if (
        typeof body === "string" ||
        body instanceof FormData ||
        body instanceof URLSearchParams ||
        body instanceof Blob ||
        body instanceof ArrayBuffer
    ) {
        return body;
    }

    if (isPlainObject(body)) {
        return JSON.stringify(body);
    }

    return body;
}

function getErrorMessage(data: unknown, fallback = "请求失败") {
    if (typeof data === "string" && data) {
        return data;
    }

    if (
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof data.message === "string" &&
        data.message
    ) {
        return data.message;
    }

    return fallback;
}

export async function request<T>(
    input: RequestInfo | URL,
    options: RequestOptions = {},
): Promise<T> {
    const { body, headers, ...rest } = options;
    const isJsonBody = isPlainObject(body);
    const payload = getRequestBody(body);
    const { error, data } = await tryto(
        (async () => {
            const response = await fetch(input, {
                ...rest,
                headers: {
                    ...(isJsonBody
                        ? { "Content-Type": "application/json" }
                        : {}),
                    ...headers,
                },
                body: payload,
            });

            const contentType = response.headers.get("content-type") ?? "";
            const isJson = contentType.includes("application/json");
            const data = isJson ? await response.json() : await response.text();

            if (!response.ok) {
                const message = getErrorMessage(data);

                Message.error(message);
                throw new RequestError(message);
            }

            if (data && typeof data === "object" && "data" in data) {
                return data.data as T;
            }

            return data as T;
        })(),
    );

    if (!error) {
        return data as T;
    }

    if (error instanceof RequestError) {
        throw error;
    }

    const message = getErrorMessage(
        error instanceof Error ? error.message : error,
        "网络异常，请稍后重试",
    );

    Message.error(message);
    throw error;
}

export default request;
