import { PoolClient } from 'pg';
import { Result } from './databases';

export interface Node {
    id: number;
    uuid: string;
    hostname: string;
    port: number;
    cpus: number;
}

export namespace nodes {
    export type External = Omit<Node, 'id'>;
    export type Payload = Omit<External, 'uuid'>;

    export const getAll = async (pg: PoolClient): Result<External[]> => {
        const { rows } = await pg.query<External>(
            `SELECT uuid, hostname, port, cpus
             FROM nodes`
        );
        return { result: rows };
    };

    export const getOne = async (pg: PoolClient, uuid: string): Result<External | null> => {
        const { rows } = await pg.query<External>(
            `SELECT uuid, hostname, port, cpus
             FROM nodes
             where uuid = $1`,
            [uuid]
        );
        return { result: rows.length === 0 ? null : rows[0] };
    };

    export const create = async (pg: PoolClient, payload: Payload): Result<string | null> => {
        const { hostname, port, cpus } = payload;

        if (!(await isNodeUnique(pg, hostname, port))) {
            return { result: null };
        }

        const { uuid } = await pg
            .query<{ uuid: string }>(
                `INSERT INTO nodes (hostname, port, cpus)
                 VALUES ($1, $2, $3)
                 RETURNING uuid`,
                [hostname, port, cpus]
            )
            .then(({ rows }) => rows[0]);

        return { result: uuid };
    };

    export const update = async (uuid: Node['uuid'], change: Partial<Payload>) => {
        const { hostname, port, cpus } = change;

        if (hostname !== undefined || port !== undefined) {
            if (port === undefined) {
            }
        }

        // Update node
        throw Error('NotImplemented');
    };

    export const remove = async (uuid: Node['uuid']) => {
        // Delete node
        throw Error('NotImplemented');
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
