import { EEXIST } from 'constants';
import { constants } from 'fs';
import { access, mkdtemp, readFile, rm, rmdir, symlink, unlink, writeFile } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { randomID } from './util/randomID.js';

export const isNodeError = (error: unknown): error is NodeJS.ErrnoException => {
    return error instanceof Error;
};

export class LockFile {
    static async acquire(target: string): Promise<LockFile | undefined> {
        const targetDir = dirname(target);
        const targetBase = basename(target);
        const lockPath = join(targetDir, targetBase + '.lock');
        const signalPath = join(targetDir, targetBase + '.lock-signal');

        for (let i = 0; i < 2; ++i) {
            try {
                await symlink(target, lockPath, 'file');
                const tmpdir = await mkdtemp(join('/tmp', `lock-signal-${randomID()}-`));
                await writeFile(signalPath, tmpdir, { encoding: 'utf-8' });
                return new LockFile(target, lockPath, signalPath);
            } catch (error) {
                if (isNodeError(error)) {
                    if (error.errno !== undefined && Math.abs(error.errno) === EEXIST) {
                        const tmpdir = await readFile(signalPath, { encoding: 'utf-8' });
                        try {
                            await access(tmpdir, constants.R_OK);
                        } catch (_) {
                            // `tmpdir` doesn't exist so we assume that the
                            // system rebooted since the lock was last acquired
                            // and that we can delete the lock and try to
                            // acquire it again
                            await unlink(lockPath);
                            continue;
                        }

                        // Lock already acquired and actively held
                        return undefined;
                    }
                }
                throw error;
            }
        }

        // Failed to acquire the lock
        return undefined;
    }

    private _locked = true;

    private constructor(
        public readonly target: string,
        public readonly lockPath: string,
        public readonly signalPath: string
    ) {}

    get locked() {
        return this._locked;
    }

    async release() {
        if (this._locked) {
            const tmpdir = await readFile(this.signalPath, { encoding: 'utf-8' });
            if (!tmpdir.startsWith('/tmp/lock-signal-')) {
                throw Error('Corrupted lockfile');
            }
            this._locked = false;
            await rmdir(tmpdir);
            await rm(this.signalPath);
            await unlink(this.lockPath);
        }
    }
}
