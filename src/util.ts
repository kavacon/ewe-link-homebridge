export function checkNotNull<T>(arg: T | undefined | null): T {
    if (arg === undefined || arg === null) {
        throw Error()
    }
    return arg;
}