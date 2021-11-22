import { FileHandle, open } from 'fs/promises';
import { copyBytes, readBytes } from './util/bytes.js';
import { digest } from './util/crc32.js';

export interface RingEntry {
    offset: number;
    index: number;
    payload: Uint8Array;
}

export class RingFile {
    // checksum(4), index(4), payload(payloadSize)
    static HEADER_SIZE = 8;

    static async open(
        path: string,
        payloadSize: number,
        maxLength: number,
        options?: { create?: boolean }
    ) {
        const entrySize = RingFile.HEADER_SIZE + payloadSize;

        // Create the file if it doesn't exist
        if (options?.create === true) {
            await open(path, 'a+').then(x => x.close());
        }

        // Open the file and truncate it to the maximum size
        const file = await open(path, 'r+');
        await file.truncate(entrySize * maxLength);

        const entry = Buffer.alloc(entrySize);
        const valid = new Set<number>();
        const entries: RingEntry[] = [];

        let i = 0;
        for (; i < maxLength; ++i) {
            await readBytes(file, entry, 0, entrySize);
            const view = new DataView(entry.buffer);
            const checksum = view.getUint32(0, true);
            const index = view.getUint32(4, true);
            const computedChecksum = digest(entry, 4, entry.byteLength - 4);
            if (checksum === computedChecksum) {
                valid.add(index);
                const offset = i * entrySize;
                const payload = new Uint8Array(entry.subarray(RingFile.HEADER_SIZE));
                entries.push({ offset, index, payload });
            }
        }

        entries.sort((x, y) => x.index - y.index);

        // Delete all entries that occurred after any corrupted entries
        for (let j = 1; j < entries.length; ++j) {
            const prevIndex = entries[j - 1].index;
            const nextIndex = entries[j].index;
            if (nextIndex - prevIndex !== 1) {
                entries.splice(j, entries.length - j);
            }
        }

        return new RingFile(file, entries, path, payloadSize, maxLength);
    }

    private constructor(
        private _file: FileHandle,
        private _entries: RingEntry[],
        public readonly path: string,
        public readonly payloadSize: number,
        public readonly maxLength: number
    ) {}

    get length() {
        return this._entries.length;
    }

    get entrySize() {
        return RingFile.HEADER_SIZE + this.payloadSize;
    }

    get maxByteSize() {
        return this.entrySize * this.maxLength;
    }

    last(): RingEntry | undefined {
        if (this._entries.length === 0) {
            return undefined;
        } else {
            return this._entries[this._entries.length - 1];
        }
    }

    async push(payload: Buffer) {
        if (payload.byteLength !== this.payloadSize) {
            throw Error('Invalid payload size');
        }

        const last = this.last();
        const offset = (last ? last.offset + this.entrySize : 0) % this.maxByteSize;
        const index = last ? last.index + 1 : 0;

        const bytes = new Uint8Array(this.entrySize);
        const view = new DataView(bytes.buffer);

        copyBytes(payload, bytes.subarray(RingFile.HEADER_SIZE));
        view.setUint32(4, index >>> 0, true);
        view.setUint32(0, digest(bytes, 4, this.entrySize - 4) >>> 0, true);

        await this._file.write(bytes, 0, bytes.byteLength, offset);
        await this._file.sync();

        const entry: RingEntry = { offset, index, payload };
        this._entries.push(entry);
        if (this._entries.length > this.maxLength) {
            this._entries.shift();
        }
    }

    *entries(): IterableIterator<RingEntry> {
        for (const entry of this._entries) {
            yield entry;
        }
    }

    async close() {
        await this._file.close();
    }
}
