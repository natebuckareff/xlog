import * as dotenv from 'dotenv';
import * as z from 'zod';

dotenv.config();

const HOSTNAME = z.string().parse(process.env.POSTGRES_HOSTNAME);
const PASSWORD = z.string().parse(process.env.POSTGRES_PASSWORD);
const USER = z.string().parse(process.env.POSTGRES_USER);
const DB = z.string().parse(process.env.POSTGRES_DB);

export const connectionString = `postgresql://${USER}:${PASSWORD}@${HOSTNAME}/${DB}`;
