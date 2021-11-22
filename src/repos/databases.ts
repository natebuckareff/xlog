import { PoolClient } from 'pg';

export type Result<T> = Promise<{ result: T }>;

export interface Database {
    id: number;
    uuid: string;
    version: number;
    name: string;
}

export namespace databases {
    export type External = Omit<Database, 'id'>;

    export const getAll = async (pg: PoolClient): Result<External[]> => {
        const { rows } = await pg.query<External>(
            `SELECT uuid, version, name
             FROM databases`
        );
        return { result: rows };
    };

    export const getOne = async (pg: PoolClient, uuid: string): Result<External | null> => {
        const { rows } = await pg.query<External>(
            `SELECT uuid, version, name
             FROM databases
             where uuid = $1`,
            [uuid]
        );
        return { result: rows.length === 0 ? null : rows[0] };
    };

    export const create = async (pg: PoolClient, name: string): Result<string | null> => {
        if (!(await isNameUnique(pg, name))) {
            return { result: null };
        }

        const { uuid } = await pg
            .query<{ uuid: string }>(
                `INSERT INTO databases (version, name)
                 VALUES (0, $1)
                 RETURNING uuid`,
                [name]
            )
            .then(({ rows }) => rows[0]);

        return { result: uuid };
    };

    export const update = async (pg: PoolClient, uuid: string, name: string): Result<boolean> => {
        if (!(await isNameUnique(pg, name))) {
            return { result: false };
        }

        const result = await pg.query(
            `UPDATE databases
             SET version = version + 1, name = $1
             WHERE uuid = $2
             RETURNING id`,
            [name, uuid]
        );

        return { result: result.rowCount === 1 };
    };
}

const isNameUnique = async (pg: PoolClient, name: string): Promise<boolean> => {
    const count = await pg
        .query<{ count: string }>(
            `SELECT count(*)
                 FROM databases
                 WHERE name = $1`,
            [name]
        )
        .then(({ rows }) => rows[0].count);

    return count === '0';
};
