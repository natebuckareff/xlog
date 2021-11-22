import { constants } from 'fs';
import { access, readdir } from 'fs/promises';
import { join } from 'path';
import { IndexFile } from './IndexFile.js';
import { ControlRecord } from './LogFile.js';
import { LogFileReader } from './LogFileReader.js';
import { binsearch } from './util/binsearch.js';
import { padOffset } from './util/padOffset.js';

export interface PartitionReaderResult {
    control?: ControlRecord;
    offset: number;
    size: number;
    payload: Buffer;
}

export class PartitionReader {
    static async open(baseDir: string, startOffset: number, maxRecordSize: number) {
        // Get all segments
        const baseOffsets: number[] = [];
        for (const name of await readdir(baseDir)) {
            if (name.endsWith('.log')) {
                const prefix = name.slice(0, name.length - 4);
                baseOffsets.push(Number.parseInt(prefix));
            }
        }

        // Sort by base offset
        baseOffsets.sort((x, y) => x - y);

        if (baseOffsets.length === 0) {
            throw Error('Unitialized partition');
        }

        // Find segment file to start reading from
        const i = binsearch(baseOffsets, startOffset);
        const baseOffset = baseOffsets[i];

        const prefix = padOffset(baseOffset);
        const logPath = join(baseDir, prefix + '.log');
        const indexPath = join(baseDir, prefix + '.index');

        // Check that the segment files are available
        let ready = false;
        try {
            // prettier-ignore
            await Promise.all([
                access(logPath, constants.R_OK),
                access(indexPath, constants.R_OK)
            ]);
            ready = true;
        } catch (_) {
            // Segment files not accessible
        }

        let reader: LogFileReader | undefined;

        if (ready) {
            // Open index file and lookup byte position associated with `_startOffset`
            const relativeStartOffset = startOffset - baseOffset;
            const index = await IndexFile.open(indexPath);
            let position: number;
            if (index.length === 0) {
                // If the index file is empty, start at the beginning
                position = 0;
            } else {
                [, , position] = await index.find(relativeStartOffset);
            }

            // Don't need to wait for this to resolve
            index.close();

            // Create log reader
            reader = await LogFileReader.open(logPath, position, maxRecordSize);
        }

        return new PartitionReader(baseDir, maxRecordSize, baseOffset, reader);
    }

    private _open = true;

    private constructor(
        public readonly baseDir: string,
        public readonly maxRecordSize: number,
        private _baseOffset: number,
        private _reader?: LogFileReader
    ) {}

    private _assertOpen() {
        if (!this._open) {
            throw Error('Resource was closed');
        }
    }

    async next(): Promise<PartitionReaderResult | null> {
        this._assertOpen;

        if (this._reader === undefined) {
            const prefix = padOffset(this._baseOffset);
            const logPath = join(this.baseDir, prefix + '.log');

            // Check that the segment log file is available
            let ready = false;
            try {
                await access(logPath, constants.R_OK);
                ready = true;
            } catch (_) {
                // Segment files not accessible
            }

            if (ready) {
                // Start reading from the beginning
                this._reader = await LogFileReader.open(logPath, 0, this.maxRecordSize);
            } else {
                return null;
            }
        }

        const result = await this._reader.next();
        if (result === null) {
            return null;
        }

        const { control, offset, size } = result;

        const absoluteOffset = this._baseOffset + offset;
        const payload = this._reader.payloadBytes;

        if (control !== undefined) {
            if (control === ControlRecord.END_OF_SEGMENT) {
                // Calculate the next base offset
                this._baseOffset = this._baseOffset + offset + 1;

                // Close the current segment; don't need to wait for it to resolve
                this._reader.close();
                delete this._reader;

                // // Try reading from the next segment
                // return await this.next();
            }

            return { control, offset: absoluteOffset, size, payload };
        }

        return { offset: absoluteOffset, size, payload };
    }

    iter(control: false): AsyncIterable<Omit<PartitionReaderResult, 'control'>>;
    iter(control: true): AsyncIterable<PartitionReaderResult>;
    iter(control: boolean): AsyncIterable<PartitionReaderResult>;

    async *iter(control: boolean): AsyncIterable<PartitionReaderResult> {
        this._assertOpen();
        let result: PartitionReaderResult | null;
        while (true) {
            result = await this.next();
            if (result === null) {
                return;
            } else if (result.control === undefined || control) {
                yield result;
            }
        }
    }

    async close() {
        if (this._open) {
            if (this._reader) {
                await this._reader.close();
            }
            this._open = false;
        }
    }
}
