export function throttle<T extends (...args: unknown[]) => void>(
    fn: T,
    ms: number,
): T {
    let lastTime = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    return ((...args: unknown[]) => {
        const now = Date.now();
        if (now - lastTime >= ms) {
            lastTime = now;
            fn(...args);
        } else if (!timer) {
            timer = setTimeout(
                () => {
                    lastTime = Date.now();
                    timer = null;
                    fn(...args);
                },
                ms - (now - lastTime),
            );
        }
    }) as T;
}

type TrytoSuccess<T> = {
    error: null;
    data: T;
};

type TrytoFailure = {
    error: any;
    data: null;
};

type TrytoResult<T> = TrytoSuccess<T> | TrytoFailure;

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
    return (
        typeof value === "object" &&
        value !== null &&
        "then" in value &&
        typeof value.then === "function"
    );
}

export function tryto<T>(task: () => Promise<T>): Promise<TrytoResult<T>>;
export function tryto<T>(task: Promise<T>): Promise<TrytoResult<T>>;
export function tryto<T>(task: () => T): TrytoResult<T>;
export function tryto<T>(task: Promise<T> | (() => T | Promise<T>)) {
    if (typeof task === "function") {
        try {
            const result = task();
            if (isPromiseLike<T>(result)) {
                return Promise.resolve(result)
                    .then((data) => ({
                        error: null,
                        data,
                    }))
                    .catch((error) => ({
                        error,
                        data: null,
                    }));
            }

            return {
                error: null,
                data: result,
            };
        } catch (error) {
            return {
                error,
                data: null,
            };
        }
    }

    return Promise.resolve(task)
        .then((data) => ({
            error: null,
            data,
        }))
        .catch((error) => ({
            error,
            data: null,
        }));
}

export function createMessageId() {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createRandomProjectId() {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    let id = "";
    for (let i = 0; i < 6; i += 1) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}
