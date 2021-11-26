import { Static, Type } from '@sinclair/typebox';
import { PoolClient } from 'pg';
import { Result } from './databases.js';

export namespace nodes {
    export const Model = Type.Object({
        id: Type.String({ format: 'uuid' }),
        hostname: Type.String({ format: 'hostname' }),
        port: Type.Integer({ minimum: 0, maximum: 0xffff }),
        cpus: Type.Integer({ minimum: 1 }),
    });

    export const Param = Type.Object({
        id: Type.String({ format: 'uuid' }),
    });

    export const Payload = Type.Object({
        hostname: Type.String({ format: 'hostname' }),
        port: Type.Integer({ minimum: 0, maximum: 0xffff }),
        cpus: Type.Integer({ minimum: 1 }),
    });

    export type Model = Static<typeof Model>;
    export type Param = Static<typeof Param>;
    export type Payload = Static<typeof Payload>;

    export const getAll = async (pg: PoolClient): Result<Model[]> => {
        const { rows } = await pg.query<Model>(
            `SELECT id, hostname, port, cpus
             FROM nodes`
        );
        return { result: rows };
    };

    export const getOne = async (pg: PoolClient, id: string): Result<Model | null> => {
        const { rows } = await pg.query<Model>(
            `SELECT id, hostname, port, cpus
             FROM nodes
             where id = $1`,
            [id]
        );
        return { result: rows.length === 0 ? null : rows[0] };
    };

    export const create = async (pg: PoolClient, payload: Payload): Result<string | null> => {
        const { hostname, port, cpus } = payload;

        if (!(await isNodeUnique(pg, hostname, port))) {
            return { result: null };
        }

        const { id } = await pg
            .query<{ id: string }>(
                `INSERT INTO nodes (hostname, port, cpus)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
                [hostname, port, cpus]
            )
            .then(({ rows }) => rows[0]);

        return { result: id };
    };

    export const update = async (pg: PoolClient, id: string, payload: Payload): Result<boolean> => {
        const { hostname, port, cpus } = payload;
        const result = await pg.query<{ id: number }>(
            `UPDATE nodes
             SET hostname = $1, port = $2, cpus = $3
             WHERE id = $4
             RETURNING id`,
            [hostname, port, cpus, id]
        );
        return { result: result.rowCount === 1 };
    };
}

const isNodeUnique = async (pg: PoolClient, hostname: string, port: number): Promise<boolean> => {
    const count = await pg
        .query<{ count: string }>(
            `SELECT count(*)
             FROM nodes
             WHERE hostname = $1 and port = $2`,
            [hostname, port]
        )
        .then(({ rows }) => rows[0].count);

    return count === '0';
};
