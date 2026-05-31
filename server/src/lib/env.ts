import { z } from 'zod';

const envSchema = z.object({
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    COOKIE_SECRET: z.string().min(32),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    CLIENT_URL: z.string(),
});

export const env = envSchema.parse(process.env);