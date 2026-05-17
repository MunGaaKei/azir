export async function tryto<T>(promise: Promise<T>) {
    try {
        const data = await promise;

        return {
            error: null,
            data,
        };
    } catch (error) {
        return {
            error,
            data: null,
        };
    }
}
