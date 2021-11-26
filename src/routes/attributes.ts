import { FastifyPluginCallback } from 'fastify';
import { attributes } from '../repos/attributes.js';

const route: FastifyPluginCallback = async fastify => {
    fastify.route({
        method: 'GET',
        url: '/attributes',
        handler: async () => {
            return await fastify.pg.transact(attributes.getAll);
        },
    });

    fastify.route({
        method: 'POST',
        url: '/attributes',
        schema: {
            body: attributes.Payload,
        },
        handler: async request => {
            const payload = request.body as attributes.Payload;
            return await fastify.pg.transact(async trx => {
                return await attributes.create(trx, payload);
            });
        },
    });

    fastify.route({
        method: 'GET',
        url: '/attribute/:id',
        schema: {
            params: attributes.Param,
        },
        handler: async request => {
            const { id } = request.params as attributes.Param;
            return await fastify.pg.transact(async trx => {
                return await attributes.getOne(trx, id);
            });
        },
    });

    fastify.route({
        method: 'PUT',
        url: '/attribute/:id',
        schema: {
            params: attributes.Param,
            body: attributes.Payload,
        },
        handler: async request => {
            const { id } = request.params as attributes.Param;
            const payload = request.body as attributes.Payload;
            return await fastify.pg.transact(async trx => {
                return await attributes.update(trx, id, payload);
            });
        },
    });
};

export default route;
