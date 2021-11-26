import { FastifyPluginCallback } from 'fastify';
import { databases } from '../repos/databases.js';

const route: FastifyPluginCallback = async fastify => {
    fastify.route({
        method: 'GET',
        url: '/databases',
        handler: async () => {
            return await fastify.pg.transact(databases.getAll);
        },
    });

    fastify.route({
        method: 'POST',
        url: '/databases',
        schema: {
            body: databases.Payload,
        },
        handler: async request => {
            const { name } = request.body as databases.Payload;
            return await fastify.pg.transact(async trx => {
                return await databases.create(trx, name);
            });
        },
    });

    fastify.route({
        method: 'GET',
        url: '/database/:id',
        schema: {
            params: databases.Param,
        },
        handler: async request => {
            const { id } = request.params as databases.Param;
            return await fastify.pg.transact(async trx => {
                return await databases.getOne(trx, id);
            });
        },
    });

    fastify.route({
        method: 'PUT',
        url: '/database/:id',
        schema: {
            params: databases.Param,
            body: databases.Payload,
        },
        handler: async request => {
            const { id } = request.params as databases.Param;
            const { name } = request.body as databases.Payload;
            return await fastify.pg.transact(async trx => {
                return await databases.update(trx, id, name);
            });
        },
    });
};

export default route;
