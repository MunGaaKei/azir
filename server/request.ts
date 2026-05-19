import { tryto } from "@/utils";
import { Message } from "@ioca/react";
import { useCallback, useRef } from "react";

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

/**
 * 管理请求取消的 hook。
 * signal() 每次调用返回新 AbortSignal 并取消上一次未完成的请求。
 * cancel() 取消当前请求。
 */
export function useAbort() {
    const ref = useRef<AbortController | null>(null);

    const signal = useCallback(() => {
        ref.current?.abort();
        ref.current = new AbortController();
        return ref.current.signal;
    }, []);

    const cancel = useCallback(() => {
        ref.current?.abort();
        ref.current = null;
    }, []);

    return { signal, cancel };
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

    // 用户主动取消请求，不弹错误提示
    if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
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
