import { FileHandle, open } from 'fs/promises';
import { Compare, DEFAULT_CMP } from './util/binsearch.js';
import { readBytes } from './util/bytes.js';

export interface IndexState {
    length: number;
}

export class IndexFile {
    // key(4), value(4)
    static ENTRY_SIZE = 8;

    static async open(path: string, options?: { cmp?: Compare<number>; create?: boolean }) {
        // Create the file if it doesn't exist
        if (options?.create === true) {
            await open(path, 'a+').then(x => x.close());
        }

        // Open the file
        const file = await open(path, 'r+');

        // Calculate index length from file size
        const length = Math.floor((await file.stat()).size / IndexFile.ENTRY_SIZE);

        return new IndexFile(file, length, path, options?.cmp);
    }

    private _lastKey?: number;
    private _scratchBytes = Buffer.alloc(IndexFile.ENTRY_SIZE);
    private _scratchView = new DataView(this._scratchBytes.buffer);

    private constructor(
        private _file: FileHandle,
        private _length: number,
        // private _capacity: number,
        public readonly path: string,
        public readonly cmp: Compare<number> = DEFAULT_CMP
    ) {}

    // get capacity() {
    //     return this._capacity;
    // }

    get length() {
        return this._length;
    }

    // get available() {
    //     return this.capacity - this.length;
    // }

    async get(index: number): Promise<[number, number]> {
        if (index < 0 || index >= this.length) {
            throw Error('Index out of range');
        }

        // await this._file.seek(index * IndexFile.ENTRY_SIZE, Deno.SeekMode.Start);
        // await readBytes(this._file, IndexFile.ENTRY_SIZE, this._scratchBytes);

        const position = index * IndexFile.ENTRY_SIZE;
        await readBytes(this._file, this._scratchBytes, 0, IndexFile.ENTRY_SIZE, position);

        const key = this._scratchView.getUint32(0, true);
        const value = this._scratchView.getUint32(4, true);
        return [key, value];
    }

    async find(key: number): Promise<[number, number, number]> {
        if (this.length === 0) {
            throw Error('Cannot search empty index');
        }

        let k0: number;
        let v0: number;
        let r: number;
        let i = 0;
        let s = 0;
        let e = this.length - 1;

        do {
            i = s + Math.floor((e - s) / 2);
            [k0, v0] = await this.get(i);
            r = this.cmp(key, k0);

            if (r === 0) {
                return [i, k0, v0];
            } else if (r < 0) {
                e = i;
            } else if (r > 0) {
                s = i;
            }
        } while (e - s > 1);

        [k0, v0] = await this.get(s);
        const [k1, v1] = await this.get(e);

        const d1 = Math.abs(this.cmp(k0, key));
        const d2 = Math.abs(this.cmp(key, k1));

        return d1 < d2 ? [s, k0, v0] : [e, k1, v1];
    }

    async add(key: number, value: number) {
        if (this._lastKey === undefined && this.length > 0) {
            this._lastKey = (await this.get(this.length - 1))[0];
        }

        if (this._lastKey !== undefined && this.cmp(key, this._lastKey) <= 0) {
            throw Error('Added keys must be increasing');
        }

        this._scratchView.setUint32(0, key >>> 0, true);
        this._scratchView.setUint32(4, value >>> 0, true);

        const offset = this.length * IndexFile.ENTRY_SIZE;
        // await this._file.seek(offset, Deno.SeekMode.Start);
        await this._file.write(this._scratchBytes, 0, IndexFile.ENTRY_SIZE, offset);

        this._lastKey = key;
        this._length += 1;
    }

    async *entries(): AsyncGenerator<[number, number, number], void, unknown> {
        // await this._file.seek(0, Deno.SeekMode.Start);
        let offset = 0;
        for (let i = 0; i < this.length; ++i) {
            await readBytes(this._file, this._scratchBytes, 0, IndexFile.ENTRY_SIZE, offset);
            offset += IndexFile.ENTRY_SIZE;
            // await readBytes(this._file, IndexFile.ENTRY_SIZE, this._scratchBytes);

            const key = this._scratchView.getUint32(0, true);
            const value = this._scratchView.getUint32(4, true);
            yield [i, key, value];
        }
    }

    // async grow(newCapacity: number) {
    //     if (newCapacity <= this.capacity) {
    //         throw Error('New capacity must be greater than current capacity');
    //     }
    //     await this._file.truncate(IndexFile.ENTRY_SIZE * newCapacity);
    //     this._capacity = newCapacity;
    // }

    async sync() {
        await this._file.sync();
    }

    async close() {
        await this._file.close();
    }
}
