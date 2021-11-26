import { FastifyPluginCallback } from 'fastify';
import { topics } from '../repos/topics.js';

const route: FastifyPluginCallback = async fastify => {
    fastify.route({
        method: 'GET',
        url: '/topics',
        handler: async () => {
            return await fastify.pg.transact(topics.getAll);
        },
    });

    fastify.route({
        method: 'POST',
        url: '/topics',
        schema: {
            body: topics.Payload,
        },
        handler: async request => {
            const payload = request.body as topics.Payload;
            return await fastify.pg.transact(async trx => {
                return await topics.create(trx, payload);
            });
        },
    });

    fastify.route({
        method: 'GET',
        url: '/topic/:id',
        schema: {
            params: topics.Param,
        },
        handler: async request => {
            const { id } = request.params as topics.Param;
            return await fastify.pg.transact(async trx => {
                return await topics.getOne(trx, id);
            });
        },
    });

    fastify.route({
        method: 'PUT',
        url: '/topic/:id',
        schema: {
            params: topics.Param,
            body: topics.Payload,
        },
        handler: async request => {
            const { id } = request.params as topics.Param;
            const payload = request.body as topics.Payload;
            return await fastify.pg.transact(async trx => {
                return await topics.update(trx, id, payload);
            });
        },
    });
};

export default route;
