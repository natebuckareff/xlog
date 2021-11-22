export const DEFAULT_CMP: Compare<number> = (x: number, y: number) => x - y;

export type Compare<T> = (x: T, y: T) => number;

export function binsearch(sorted: number[], needle: number, cmp?: Compare<number>): number;
export function binsearch<T>(sorted: T[], needle: T, cmp?: Compare<T>): number;
export function binsearch<T>(sorted: T[], needle: T, cmp?: Compare<T>): number;

// deno-lint-ignore no-explicit-any
export function binsearch(array: number[], target: number, cmp?: Compare<any>) {
    cmp ??= DEFAULT_CMP;
    let r: number;
    let i = 0;
    let s = 0;
    let e = array.length;
    do {
        i = s + Math.floor((e - s) / 2);
        r = cmp(target, array[i]);
        if (r === 0) {
            return i;
        } else if (r < 0) {
            e = i;
        } else if (r > 0) {
            s = i;
        }
    } while (e - s > 1);
    return s;
}
