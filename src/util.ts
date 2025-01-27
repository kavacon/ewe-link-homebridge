export function checkNotNull<T>(arg: T | undefined | null): T {
    if (arg === undefined || arg === null) {
        throw Error()
    }
    return arg;
}

export function deleteFrom<T>(value: T, list: Array<T>): Array<T> {
    const idx = list.indexOf(value);
    return list.splice(idx, 1);
}

export function deleteIf<T>(predicate: (item: T) => boolean, list: Array<T>):  Array<T> {
    const idx = list.findIndex(predicate);
    if (idx < 0) {
        return list;
    }
    return list.splice(idx, 1);
}