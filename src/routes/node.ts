import { FastifyPluginCallback } from 'fastify';
import { nodes } from '../repos/node.js';

const route: FastifyPluginCallback = async fastify => {
    fastify.route({
        method: 'GET',
        url: '/nodes',
        handler: async () => {
            return await fastify.pg.transact(nodes.getAll);
        },
    });

    fastify.route({
        method: 'POST',
        url: '/nodes',
        schema: {
            body: nodes.Payload,
        },
        handler: async request => {
            const payload = request.body as nodes.Payload;
            return await fastify.pg.transact(async trx => {
                return await nodes.create(trx, payload);
            });
        },
    });

    fastify.route({
        method: 'GET',
        url: '/node/:id',
        schema: {
            params: nodes.Param,
        },
        handler: async request => {
            const { id } = request.params as nodes.Param;
            return await fastify.pg.transact(async trx => {
                return await nodes.getOne(trx, id);
            });
        },
    });

    fastify.route({
        method: 'PUT',
        url: '/node/:id',
        schema: {
            params: nodes.Param,
            body: nodes.Payload,
        },
        handler: async request => {
            const { id } = request.params as nodes.Param;
            const payload = request.body as nodes.Payload;
            return await fastify.pg.transact(async trx => {
                return await nodes.update(trx, id, payload);
            });
        },
    });
};

export default route;
