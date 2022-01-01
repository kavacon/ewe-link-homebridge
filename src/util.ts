export function checkNotNull<T>(arg: T | undefined | null): T {
    if (arg === undefined || arg === null) {
        throw Error()
    }
    return arg;
}

export function deleteFrom<T>(value: T, list: Array<T>) {
    const idx = list.indexOf(value);
    list.splice(idx, 1);
}