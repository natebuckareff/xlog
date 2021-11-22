import { randomBytes } from 'crypto';

export const randomID = () => randomBytes(16).toString('hex');
