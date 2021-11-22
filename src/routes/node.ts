import { FastifyPluginCallback } from 'fastify';
import { nodes } from '../repos/node';

const node: FastifyPluginCallback = async fastify => {
    fastify.route({
        method: 'GET',
        url: '/node',
        handler: async () => {
            return await fastify.pg.transact(nodes.getAll);
        },
    });

    // fastify.route({
    //     method: 'GET',
    //     url: '/node/:uuid',
    //     schema: {
    //         params: S.object().prop('uuid', S.string().format('uuid')).required(),
    //     },
    //     handler: async request => {
    //         //
    //     },
    // });

    // fastify.route({
    //     method: 'POST',
    //     url: '/node',
    //     schema: {
    //         body: S.object()
    //             .prop('hostname', S.string().format('hostname'))
    //             .prop('port', S.integer().minimum(0).maximum(0xffff))
    //             .prop('cpus', S.integer().minimum(1))
    //             .required(['hostname', 'port', 'cpus']),
    //     },
    //     handler: async request => {
    //         //
    //     },
    // });

    // fastify.route({
    //     method: 'PATCH',
    //     url: '/node/:uuid',
    //     schema: {
    //         params: S.object().prop('uuid', S.string().format('uuid')).required(),
    //         body: S.object()
    //             .prop('hostname', S.string().format('hostname'))
    //             .prop('port', S.integer().minimum(0).maximum(0xffff))
    //             .prop('cpus', S.integer().minimum(1)),
    //     },
    //     handler: async (request, reply) => {
    //         //
    //     },
    // });

    // fastify.route({
    //     method: 'DELETE',
    //     url: '/node/:uuid',
    //     schema: {
    //         params: S.object().prop('uuid', S.string().format('uuid')).required(),
    //     },
    //     handler: async (request, reply) => {
    //         //
    //     },
    // });
};

export default node;
