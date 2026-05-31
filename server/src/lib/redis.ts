import { Redis } from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

redis.on('error', (err: Error) => {
    console.error('Redis error:', err);
});