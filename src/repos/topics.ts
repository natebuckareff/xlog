import { Static, Type } from '@sinclair/typebox';
import { PoolClient } from 'pg';
import { databases, Result } from './databases.js';

export namespace topics {
    const Model = Type.Object({
        pk: Type.Integer(),
        id: Type.String({ format: 'uuid' }),
        db_id: Type.String({ format: 'uuid' }),
        db_version: Type.Integer(),
        time: Type.String({ format: 'date-time' }),
        name: Type.String(),
    });

    export const Param = Type.Object({
        id: Type.String({ format: 'uuid' }),
    });

    export const Payload = Type.Object({
        db: Type.Object({
            id: Type.String({ format: 'uuid' }),
        }),
        name: Type.String(),
    });

    export const View = Type.Object({
        id: Type.String({ format: 'uuid' }),
        db: Type.Object({
            id: Type.String({ format: 'uuid' }),
            version: Type.Integer(),
        }),
        time: Type.String({ format: 'date-time' }),
        name: Type.String(),
    });

    export type Model = Static<typeof Model>;
    export type Param = Static<typeof Param>;
    export type Payload = Static<typeof Payload>;
    export type View = Static<typeof View>;

    const map = (row: Model): View => {
        const { id, db_id, db_version, time, name } = row;
        return {
            id,
            db: { id: db_id, version: db_version },
            time,
            name,
        };
    };

    export const getAll = async (pg: PoolClient): Result<View[]> => {
        const { rows } = await pg.query<Model>(
            `SELECT DISTINCT ON (db_id, id) *
            FROM topics
            ORDER BY db_id, id, db_version DESC`
        );
        const result: View[] = rows.map(map);
        return { result };
    };

    export const getOne = async (pg: PoolClient, id: string): Result<View | null> => {
        const { rows } = await pg.query<Model>(
            `SELECT DISTINCT ON (db_id, id) *
            FROM topics
            WHERE id = $1
            ORDER BY db_id, id, db_version DESC`,
            [id]
        );
        if (rows.length === 0) {
            return { result: null };
        }
        return { result: map(rows[0]) };
    };

    export const create = async (pg: PoolClient, payload: Payload): Result<string | null> => {
        // Check that the database exists
        const db = await databases.getOne(pg, payload.db.id);
        if (db.result === null) {
            console.log('Database does not exist');
            return { result: null };
        }

        // Check that the topic name is unique in the database
        if (!(await isTopicUnique(pg, payload.db.id, payload.name))) {
            console.log('Topic name not unique');
            return { result: null };
        }

        // Insert the new topic, increment the database version, and return the
        // topic id
        const { id } = await pg
            .query<{ id: string }>(
                `WITH u (db_id, db_version, name) as (
                    UPDATE databases
                    SET version = version + 1
                    WHERE id = $1
                    RETURNING $1::uuid, version, $2
                )
                INSERT INTO topics (db_id, db_version, name)
                SELECT * from u
                RETURNING id`,
                [payload.db.id, payload.name]
            )
            .then(x => x.rows[0]);

        return { result: id };
    };

    export const update = async (pg: PoolClient, id: string, payload: Payload): Result<boolean> => {
        // Check that the topic exists
        if ((await getOne(pg, id)).result === null) {
            console.log('Topic does not exist');
            return { result: false };
        }

        // Check that the database exists
        const db = await databases.getOne(pg, payload.db.id);
        if (db.result === null) {
            console.log('Database does not exist');
            return { result: false };
        }

        // Check that the topic name is unique in the database
        if (!(await isTopicUnique(pg, payload.db.id, payload.name))) {
            console.log('Topic name not unique');
            return { result: false };
        }

        // Insert the new topic and increment the database version
        const { rowCount } = await pg.query(
            `WITH u (id, db_id, version, name) as (
                UPDATE databases
                SET version = version + 1
                WHERE id = $2
                RETURNING $1::uuid, $2::uuid, version, $3
            )
            INSERT INTO topics (id, db_id, db_version, name)
            SELECT * from u
            RETURNING id`,
            [id, payload.db.id, payload.name]
        );

        return { result: rowCount > 0 };
    };
}

const isTopicUnique = async (pg: PoolClient, dbId: string, name: string): Promise<boolean> => {
    const count = await pg
        .query<{ count: string }>(
            `SELECT *
            FROM (
                SELECT count(*)
                FROM (
                    SELECT DISTINCT ON (db_id, id) "name"
                    FROM topics 
                    WHERE db_id = $1
                    ORDER BY db_id, id, db_version DESC
                ) as q1
                WHERE name = $2
            ) as q2 `,
            [dbId, name]
        )
        .then(({ rows }) => rows[0].count);

    return count === '0';
};
