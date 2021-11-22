import { FileHandle } from 'fs/promises';

export const readBytes = async (
    file: FileHandle,
    buffer: Buffer,
    offset: number,
    length: number,
    position?: number | null
): Promise<number> => {
    let r = 0;
    while (r < length) {
        const size = length - r;
        const { bytesRead } = await file.read(buffer, offset + r, size, position);
        r += bytesRead;
        if (bytesRead < size) {
            break;
        }
    }
    return r;
};

export const writeAllBytes = async (
    file: FileHandle,
    buffer: Buffer,
    offset: number,
    length: number,
    position?: number | null
): Promise<void> => {
    let r = 0;
    while (r < length) {
        const size = length - r;
        const { bytesWritten } = await file.write(buffer, offset + r, size, position);
        r += bytesWritten;
    }
};

export const copyBytes = (src: Uint8Array, dst: Uint8Array, offset = 0, length?: number) => {
    let j = 0;
    let l = length ?? src.byteLength;
    for (let i = offset; i < dst.byteLength && j < l; ++i) {
        dst[i] = src[j];
        j += 1;
    }
    return j;
};

export const copyBytes2 = (
    srcBuffer: Uint8Array,
    srcOffset: number,
    dstBuffer: Uint8Array,
    dstOffset: number
) => {
    const srcLen = srcBuffer.byteLength;
    const dstLen = dstBuffer.byteLength;
    let i = srcOffset;
    let j = dstOffset;
    while (i < srcLen && j < dstLen) {
        dstBuffer[j] = srcBuffer[i];
        i += 1;
        j += 1;
    }
    return j;
};

export const growBuffer = (bytes: Uint8Array, size: number) => {
    if (bytes.length >= size) {
        return bytes;
    }
    const newBytes = new Uint8Array(size);
    copyBytes(bytes, newBytes);
    return newBytes;
};
