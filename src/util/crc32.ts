// Adapted from: https://stackoverflow.com/a/18639999

const createTable = () => {
    const table: number[] = [];
    let c;
    for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c;
    }
    return table;
};

const TABLE = createTable();

export function digest(input: string): number;
export function digest(input: Uint8Array, offset?: number, length?: number): number;
export function digest(input: string | Uint8Array, offset?: number, length?: number): number {
    return typeof input === 'string' ? digestString(input) : digestBytes(input, offset, length);
}

function digestString(str: string) {
    let crc = 0 ^ -1;
    for (let i = 0; i < str.length; i++) {
        crc = (crc >>> 8) ^ TABLE[(crc ^ str.charCodeAt(i)) & 0xff];
    }
    return (crc ^ -1) >>> 0;
}

function digestBytes(bytes: Uint8Array, offset = 0, length = bytes.byteLength) {
    let crc = 0 ^ -1;
    for (let i = 0; i < length; i++) {
        crc = (crc >>> 8) ^ TABLE[(crc ^ bytes[offset + i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
}
