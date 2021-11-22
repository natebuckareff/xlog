import { FastifyPluginAsync } from 'fastify';
import AutoLoad from 'fastify-autoload';
import Postgres from 'fastify-postgres';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { connectionString } from './connectionString.js';

const main: FastifyPluginAsync = async function (fastify, opts) {
    // fastify.register(Env, {
    //     schema: {
    //         type: 'object',
    //         properties: {
    //             POSTGRES_HOSTNAME: { type: 'string' },
    //             POSTGRES_PASSWORD: { type: 'string' },
    //             POSTGRES_USER: { type: 'string' },
    //             POSTGRES_DB: { type: 'string' },
    //         },
    //     },
    // });

    // fastify.register(Sensible);

    fastify.register(Postgres, { connectionString });

    fastify.register(AutoLoad, {
        dir: join(dirname(fileURLToPath(import.meta.url)), 'routes'),
        dirNameRoutePrefix: false,
        options: { ...opts },
    });
};

export default main;
