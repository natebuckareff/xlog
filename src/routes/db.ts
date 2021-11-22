import { FastifyPluginCallback } from 'fastify';
import S from 'fluent-json-schema';
import { databases } from '../repos/databases.js';

const _db: FastifyPluginCallback = async fastify => {
    fastify.route({
        method: 'GET',
        url: '/db',
        handler: async () => {
            return await fastify.pg.transact(databases.getAll);
        },
    });

    fastify.route({
        method: 'GET',
        url: '/db/:uuid',
        schema: {
            params: S.object().prop('uuid', S.string().format('uuid')).required(),
        },
        handler: async request => {
            interface Params {
                uuid: string;
            }
            const { uuid } = request.params as Params;
            return await fastify.pg.transact(async trx => {
                return await databases.getOne(trx, uuid);
            });
        },
    });

    fastify.route({
        method: 'POST',
        url: '/db',
        schema: {
            body: S.object().prop('name', S.string()).required(),
        },
        handler: async request => {
            interface Body {
                name: string;
            }
            const { name } = request.body as Body;
            return await fastify.pg.transact(async trx => {
                return await databases.create(trx, name);
            });
        },
    });

    fastify.route({
        method: 'PATCH',
        url: '/db/:uuid',
        schema: {
            params: S.object().prop('uuid', S.string().format('uuid')).required(),
            body: S.object().prop('name', S.string()).required(),
        },
        handler: async request => {
            interface Params {
                uuid: string;
            }
            interface Body {
                name: string;
            }
            const { uuid } = request.params as Params;
            const { name } = request.body as Body;
            return await fastify.pg.transact(async trx => {
                return await databases.update(trx, uuid, name);
            });
        },
    });
};

export default _db;
