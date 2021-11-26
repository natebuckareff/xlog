import { FastifyPluginCallback } from 'fastify';
import { partitions } from '../repos/partitions.js';

const route: FastifyPluginCallback = async fastify => {
    fastify.route({
        method: 'GET',
        url: '/partitions',
        handler: async () => {
            return await fastify.pg.transact(partitions.getAll);
        },
    });

    fastify.route({
        method: 'POST',
        url: '/partitions',
        schema: {
            body: partitions.Payload,
        },
        handler: async request => {
            const payload = request.body as partitions.Payload;
            return await fastify.pg.transact(async trx => {
                return await partitions.create(trx, payload);
            });
        },
    });

    fastify.route({
        method: 'GET',
        url: '/partition',
        schema: {
            querystring: partitions.Query,
        },
        handler: async request => {
            const { value } = request.query as partitions.Query;
            return await fastify.pg.transact(async trx => {
                return await partitions.getOneByHash(trx, value);
            });
        },
    });

    fastify.route({
        method: 'GET',
        url: '/partition/:id',
        schema: {
            params: partitions.Param,
        },
        handler: async request => {
            const { id } = request.params as partitions.Param;
            return await fastify.pg.transact(async trx => {
                return await partitions.getOne(trx, id);
            });
        },
    });
};

export default route;
