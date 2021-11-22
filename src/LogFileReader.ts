import { FileHandle, open } from 'fs/promises';
import { ControlRecord, LogFile } from './LogFile.js';
import { readBytes } from './util/bytes.js';
import { digest } from './util/crc32.js';

export class LogFileReader {
    static async open(path: string, position: number, maxRecordSize: number) {
        const file = await open(path, 'r');
        return new LogFileReader(file, position, maxRecordSize);
    }

    private _scratchBytes: Buffer = Buffer.alloc(LogFile.HEADER_SIZE + this.maxRecordSize);
    private _scratchView: DataView = new DataView(this._scratchBytes.buffer);

    public readonly payloadBytes: Buffer = this._scratchBytes.subarray(LogFile.HEADER_SIZE);

    private constructor(
        private _file: FileHandle,
        private _position: number,
        public readonly maxRecordSize: number
    ) {}

    private _validateChecksum(size: number) {
        const checksum = this._scratchView.getUint32(0, true);
        const computedChecksum = digest(this._scratchBytes, 4, LogFile.HEADER_SIZE + size - 4);
        if (checksum !== computedChecksum) {
            throw Error('Invalid checksum');
        }
    }

    async next(): Promise<{ control?: ControlRecord; offset: number; size: number } | null> {
        let r: number;

        // Read header into scratch buffer
        r = await readBytes(this._file, this._scratchBytes, 0, LogFile.HEADER_SIZE, this._position);
        if (r < LogFile.HEADER_SIZE) {
            // Potential EOF
            return null;
        }

        const offset = this._scratchView.getUint32(4, true);
        const size = this._scratchView.getUint32(8, true);

        const isControlRecord = size === LogFile.CONTROL_RECORD_MARKER;
        const payloadSize = isControlRecord ? LogFile.CONTROL_RECORD_PAYLOAD_SIZE : size;

        // Read payload into scatch buffer
        r = await readBytes(
            this._file,
            this._scratchBytes,
            LogFile.HEADER_SIZE,
            payloadSize,
            this._position + LogFile.HEADER_SIZE
        );
        if (r < payloadSize) {
            // Potential EOF
            return null;
        }

        this._validateChecksum(payloadSize);

        // Advance to the next record
        this._position += LogFile.HEADER_SIZE + payloadSize;

        // Validate control records
        if (isControlRecord) {
            const control = this.payloadBytes.readUInt32LE(0);
            switch (control) {
                case ControlRecord.END_OF_SEGMENT:
                case ControlRecord.COMMIT:
                    return { control, offset, size: payloadSize };

                default:
                    throw Error(`Unknown control record type: control=${control}`);
            }
        }

        return { offset, size: payloadSize };
    }

    async close() {
        await this._file.close();
    }
}
