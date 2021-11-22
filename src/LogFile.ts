import { FileHandle, open } from 'fs/promises';
import { copyBytes, readBytes, writeAllBytes } from './util/bytes.js';
import { digest } from './util/crc32.js';

export interface LogFileState {
    byteLength: number;
    nextRelativeOffset: number;
}

// prettier-ignore
export enum ControlRecord {
    END_OF_SEGMENT = 0x00000001,
    COMMIT         = 0x00000002,
}

export class LogFile {
    // checksum(4), offset(4), size(4), payload(*)
    static HEADER_SIZE = 4 * 3;

    static CONTROL_RECORD_MARKER = 0xffffffff >>> 0;
    static CONTROL_RECORD_PAYLOAD_SIZE = 4;

    // checksum(4), offset(4), 0xffffffff(4), payload(4)
    static CONTROL_RECORD_SIZE = LogFile.HEADER_SIZE + LogFile.CONTROL_RECORD_PAYLOAD_SIZE;

    static async open(path: string, maxRecordSize: number, state?: LogFileState) {
        if (maxRecordSize < 4) {
            throw Error(
                'The maximum record payload size cannot be smaller than a control payload.'
            );
        }

        // Create the file if it doesn't exist
        await open(path, 'a+').then(x => x.close());

        const file = await open(path, 'r+');

        return new LogFile(file, state, path, maxRecordSize);
    }

    // private _length = 0;
    private _scratchBytes = Buffer.alloc(LogFile.HEADER_SIZE + this.maxRecordSize);
    private _scratchView = new DataView(this._scratchBytes.buffer);

    private constructor(
        private _file: FileHandle,
        private _state: LogFileState | undefined,
        public readonly path: string,
        public readonly maxRecordSize: number
    ) {}

    private _getState(): LogFileState {
        if (this._state === undefined) {
            throw Error('Log state not built');
        }
        return this._state;
    }

    // get length() {
    //     return this._length;
    // }

    get byteLength() {
        return this._getState().byteLength;
    }

    getState(): LogFileState {
        return { ...this._getState() };
    }

    async rebuildState() {
        // Reset log state
        this._state = { byteLength: 0, nextRelativeOffset: 0 };
        const state = this._getState();

        // Scratch buffer
        const bytes = this._scratchBytes;
        const view = this._scratchView;

        let r: number;
        let byteOffset = 0;

        while (true) {
            // Read header into scratch buffer
            r = await readBytes(this._file, bytes, 0, LogFile.HEADER_SIZE, byteOffset);
            if (r < LogFile.HEADER_SIZE) {
                // EOF
                break;
            }
            byteOffset += LogFile.HEADER_SIZE;

            const checksum = view.getUint32(0, true);
            const offset = view.getUint32(4, true);
            const size = view.getUint32(8, true);

            // Uninitialized record
            if (size === 0) {
                break;
            }

            // Check the maxRecordSize constraint
            if (size > this.maxRecordSize) {
                throw Error('Invalid record size');
            }

            // Read payload into scratch buffer
            r = await readBytes(this._file, bytes, LogFile.HEADER_SIZE, size, byteOffset);
            if (r < size) {
                // EOF
                break;
            }
            byteOffset += size;

            // Validate the checksum
            const computedChecksum = digest(bytes, 4, LogFile.HEADER_SIZE + size - 4);
            if (checksum !== computedChecksum) {
                throw Error('Invalid checksum');
            }

            state.byteLength += LogFile.HEADER_SIZE + size;
            state.nextRelativeOffset = offset + 1;
            // this._length += 1;
        }
    }

    async getUncommitedControlRecord(): Promise<ControlRecord | undefined> {
        let r: number;

        // Read the next CONTROL_RECORD_SIZE bytes
        r = await readBytes(
            this._file,
            this._scratchBytes,
            0,
            LogFile.CONTROL_RECORD_SIZE,
            this.byteLength
        );

        if (r < LogFile.CONTROL_RECORD_SIZE) {
            return undefined;
        }

        // Validate the checksum
        const checksum = this._scratchView.getUint32(0, true);
        const computedChecksum = digest(this._scratchBytes, 4, LogFile.CONTROL_RECORD_SIZE - 4);
        if (checksum !== computedChecksum) {
            return undefined;
        }

        return this._scratchView.getUint32(12, true);
    }

    async append(payload: Buffer | Uint8Array): Promise<{ offset: number; position: number }> {
        const state = this._getState();
        const payloadSize = payload.byteLength;
        const recordSize = LogFile.HEADER_SIZE + payloadSize;

        // Validate the payload size
        if (payloadSize === 0 || payloadSize > this.maxRecordSize) {
            throw Error('Invalid record size');
        }

        // Scratch buffer
        const bytes = this._scratchBytes;
        const view = this._scratchView;

        // Copy the payload into the scratch buffer (after the  header)
        copyBytes(payload, bytes, LogFile.HEADER_SIZE);

        // Write the record header offset and payload size
        const offset = state.nextRelativeOffset;
        view.setUint32(4, offset >>> 0, true);
        view.setUint32(8, payloadSize >>> 0, true);

        // Compute the record checksum and write it to the record header
        // const checksum = digest(bytes.subarray(4, recordSize));
        const checksum = digest(bytes, 4, recordSize - 4);
        view.setUint32(0, checksum >>> 0, true);

        // Write the scratch buffer to the log file
        await writeAllBytes(this._file, bytes, 0, recordSize, this.byteLength);
        const position = state.byteLength;

        // Update log state
        state.byteLength += recordSize;
        state.nextRelativeOffset += 1;
        // this._length += 1;

        // Return the record offset and byte position
        return { offset, position };
    }

    async appendControlRecord(type: ControlRecord): Promise<{ offset: number; position: number }> {
        const state = this._getState();

        // Write the control record header and payload
        const offset = state.nextRelativeOffset;
        this._scratchView.setUint32(4, offset >>> 0, true);
        this._scratchView.setUint32(8, LogFile.CONTROL_RECORD_MARKER, true);
        this._scratchView.setUint32(12, type >>> 0, true);

        // Compute the record checksum and write it to the record header
        // const checksum = digest(bytes.subarray(4, recordSize));
        const checksum = digest(this._scratchBytes, 4, LogFile.CONTROL_RECORD_SIZE - 4);
        this._scratchView.setUint32(0, checksum >>> 0, true);

        // Write the scratch buffer to the log file
        await writeAllBytes(
            this._file,
            this._scratchBytes,
            0,
            LogFile.CONTROL_RECORD_SIZE,
            this.byteLength
        );
        const position = state.byteLength;

        // Update log state
        state.byteLength += LogFile.CONTROL_RECORD_SIZE;
        state.nextRelativeOffset += 1;
        // this._length += 1;

        // Return the record offset and byte position
        return { offset, position };
    }

    async sync() {
        await this._file.sync();
    }

    async close() {
        await this._file.close();
    }
}
