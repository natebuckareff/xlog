import { mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import { IndexFile } from './IndexFile.js';
import { LockFile } from './LockFile.js';
import { ControlRecord, LogFile, LogFileState } from './LogFile.js';
import { RingFile } from './RingFile.js';
import { padOffset } from './util/padOffset.js';

export class PartitionWriter {
    // baseOffset(4), byteLength(4), nextRelativeOffset(4)
    static SNAPSHOT_SIZE = 4 * 3;

    // Maximum number of snapshots
    static SNAPSHOT_COUNT = 4;

    static async open(baseDir: string, maxRecordSize: number, options?: { create?: boolean }) {
        // Create the partition directory if it doesn't exist
        await mkdir(baseDir, { recursive: options?.create === true });

        // List all segments
        const segmentBaseOffsets: number[] = [];
        for (const name of await readdir(baseDir)) {
            if (name.endsWith('.log')) {
                const prefix = name.slice(0, name.length - 4);
                segmentBaseOffsets.push(Number.parseInt(prefix));
            }
        }

        // Sort by base offset
        segmentBaseOffsets.sort((x, y) => x - y);

        // Open snapshot file
        const snapshotPath = join(baseDir, 'snapshot');
        const snapshot = await RingFile.open(
            snapshotPath,
            PartitionWriter.SNAPSHOT_SIZE,
            PartitionWriter.SNAPSHOT_COUNT,
            { create: true }
        );

        // Attempt to lock the snapshot file
        const lock = await LockFile.acquire(snapshotPath);
        if (lock === undefined) {
            return undefined;
        }

        // Read last commit
        const last = snapshot.last();

        // Producer state
        let activeBaseOffset: number | undefined;
        let state: LogFileState | undefined;

        // Load last committed producer state
        if (last !== undefined) {
            const view = new DataView(last.payload.buffer);
            activeBaseOffset = view.getUint32(0, true);
            state = {
                byteLength: view.getUint32(4, true),
                nextRelativeOffset: view.getUint32(8, true),
            };
        }

        // If the partition is empty, set it up for initialization
        if (segmentBaseOffsets.length === 0) {
            segmentBaseOffsets.push(0);
        }

        // If activeBaseOffset is undefined then either the partition is empty
        // or we crashed before committing on a previous initialization attempt
        const initialize = activeBaseOffset === undefined;
        if (activeBaseOffset === undefined) {
            if (segmentBaseOffsets.length > 1) {
                // There should never be more than one uncommitted segment in an
                // uninitialized partition
                throw Error('Assertion failed');
            }
            activeBaseOffset = 0;
            state = { byteLength: 0, nextRelativeOffset: 0 };
        }

        const prefix = padOffset(activeBaseOffset);
        const logPath = join(baseDir, prefix + '.log');
        const indexPath = join(baseDir, prefix + '.index');

        // Open active segment log and index files
        const [log, index] = await Promise.all([
            LogFile.open(logPath, maxRecordSize, state),
            IndexFile.open(indexPath, { create: true }),
        ]);

        // ON-CRASH: The log and index file will be reused.

        const writer = new PartitionWriter(
            lock,
            activeBaseOffset,
            snapshot,
            log,
            index,
            baseDir,
            maxRecordSize
        );

        // Commit initial active segment
        if (initialize) {
            await writer.commit({ force: true, noAppend: true });
        }

        // ON-CRASH: Snapshot won't be empty and therefore `initialize` will be
        // false

        // Check if there is an uncommitted EOS record,
        if ((await log.getUncommitedControlRecord()) === ControlRecord.END_OF_SEGMENT) {
            await writer.split();
        }

        return writer;
    }

    private _open = true;
    private _dirty = false;
    private _scratchBuffer = Buffer.alloc(PartitionWriter.SNAPSHOT_SIZE);
    private _scratchView = new DataView(this._scratchBuffer.buffer);

    private constructor(
        private _lock: LockFile,
        private _activeBaseOffset: number,
        private _snapshot: RingFile,
        private _activeLog: LogFile,
        private _activeIndex: IndexFile,
        public readonly baseDir: string,
        public readonly maxRecordSize: number
    ) {}

    private _assertOpen() {
        if (!this._open) {
            throw Error('Resource was closed');
        }
    }

    get log(): Readonly<LogFile> {
        return this._activeLog;
    }

    async append(payload: Buffer | Uint8Array) {
        this._assertOpen();
        const { offset, position } = await this._activeLog.append(payload);
        await this._activeIndex.add(offset, position);
        this._dirty = true;
        return this._activeBaseOffset + offset;
    }

    private async _appendControlRecord(type: ControlRecord) {
        const result = await this._activeLog.appendControlRecord(type);
        await this._activeIndex.add(result.offset, result.position);
        return result;
    }

    async split() {
        this._assertOpen();

        if (this._activeLog.byteLength === 0) {
            throw Error('Cannot split empty segment');
        }

        // Commit any pending writes
        await this.commit();

        // Append EOS record
        const { offset: offsetEOS } = await this._appendControlRecord(ControlRecord.END_OF_SEGMENT);

        // ON-CRASH: Uncommitted EOS record will be overwritten

        // Flush EOS record to disk. Guarantees that the EOS record is visible
        // in case of uncommitted segment files
        await this._activeLog.sync();

        // ON-CRASH: The EOS record is still uncommitted and will be overwritten

        // Compute new active base offset
        this._activeBaseOffset += offsetEOS + 1;

        const prefix = padOffset(this._activeBaseOffset);
        const logPath = join(this.baseDir, prefix + '.log');
        const indexPath = join(this.baseDir, prefix + '.index');

        // Create new active segment files
        [this._activeLog, this._activeIndex] = await Promise.all([
            LogFile.open(logPath, this.maxRecordSize, { byteLength: 0, nextRelativeOffset: 0 }),
            IndexFile.open(indexPath, { create: true }),
        ]);

        // ON-CRASH: Previously created segment files are opened and reused

        // Commit the new active segment. Forcefully because the partition
        // hasn't been marked dirty yet and not appending a commit control
        // message because an EOS implies a commit
        await this.commit({ force: true, noAppend: true });
    }

    async commit(options?: { force?: boolean; noAppend?: boolean }) {
        this._assertOpen();

        if (this._dirty || options?.force === true) {
            // Append the commit record
            if (!options?.noAppend) {
                await this._appendControlRecord(ControlRecord.COMMIT);
            }

            // ON-CRASH: The control record was not committed and therefore be
            // overwritten

            // Get current producer state
            const { byteLength, nextRelativeOffset } = this._activeLog.getState();

            this._scratchView.setUint32(0, this._activeBaseOffset >>> 0, true);
            this._scratchView.setUint32(4, byteLength >>> 0, true);
            this._scratchView.setUint32(8, nextRelativeOffset >>> 0, true);

            // fsync segment files
            await Promise.all([this._activeLog.sync(), this._activeIndex.sync()]);

            // ON-CRASH: Segment files are fsynced, but still not written to the
            // snapshot. The commit control record will be overwritten

            // Write to the snapshot file
            await this._snapshot.push(this._scratchBuffer);

            this._dirty = false;
        }
    }

    async close() {
        if (this._open) {
            await this.commit();
            await Promise.all([this._activeLog.close(), this._activeIndex.close()]);
            await this._lock.release();
            this._open = false;
        }
    }
}
