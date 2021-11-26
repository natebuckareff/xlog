import { Static, Type } from '@sinclair/typebox';
import { PoolClient } from 'pg';

export type Result<T> = Promise<{ result: T }>;

export namespace databases {
    export const Model = Type.Object({
        id: Type.String({ format: 'uuid' }),
        version: Type.Integer(),
        name: Type.String(),
    });

    export const Param = Type.Object({
        id: Type.String({ format: 'uuid' }),
    });

    export const Payload = Type.Object({
        name: Type.String(),
    });

    export type Model = Static<typeof Model>;
    export type Param = Static<typeof Param>;
    export type Payload = Static<typeof Payload>;

    export const getAll = async (pg: PoolClient): Result<Model[]> => {
        const { rows } = await pg.query<Model>(
            `SELECT id, version, name
             FROM databases`
        );
        return { result: rows };
    };

    export const getOne = async (pg: PoolClient, id: string): Result<Model | null> => {
        const { rows } = await pg.query<Model>(
            `SELECT id, version, name
             FROM databases
             where id = $1`,
            [id]
        );
        return { result: rows.length === 0 ? null : rows[0] };
    };

    export const create = async (pg: PoolClient, name: string): Result<string | null> => {
        if (!(await isNameUnique(pg, name))) {
            return { result: null };
        }

        const { id } = await pg
            .query<{ id: string }>(
                `INSERT INTO databases (version, name)
                 VALUES (0, $1)
                 RETURNING id`,
                [name]
            )
            .then(({ rows }) => rows[0]);

        return { result: id };
    };

    export const update = async (pg: PoolClient, id: string, name: string): Result<boolean> => {
        if (!(await isNameUnique(pg, name))) {
            return { result: false };
        }

        const result = await pg.query(
            `UPDATE databases
             SET version = version + 1, name = $1
             WHERE id = $2
             RETURNING id`,
            [name, id]
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
