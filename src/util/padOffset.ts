// Zero-pad number to largest 64-bit unsigned integer
export const padOffset = (offset: number) => {
    const s = offset + '';
    const p = 20 - s.length;
    return '0'.repeat(p) + s;
};
