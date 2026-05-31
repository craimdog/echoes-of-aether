import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifySensible from '@fastify/sensible';
import { env } from './lib/env.js';
import authPlugin from './plugins/auth.plugin.js';
import authRoutes from './routes/auth.routes.js';
import characterRoutes from './routes/character.routes.js';
import zoneRoutes from './routes/zone.routes.js';
import socketPlugin from './plugins/socket.plugin.js';
import questRoutes from './routes/quest.routes.js';
import { startWorldEventsWorker } from './workers/world-events.worker.js';
import adminPlugin from './plugins/admin.plugin.js';
import adminRoutes from './routes/admin.routes.js';
import guildRoutes from './routes/guild.route.js';

const server = Fastify({
    logger: {
        level: env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
    },
});

await server.register(fastifyCors, {
    origin: env.CLIENT_URL,
    credentials: true,
});

await server.register(fastifyCookie, {
    secret: env.COOKIE_SECRET,
});

await server.register(fastifySensible);
await server.register(authPlugin);
await server.register(adminPlugin);
await server.register(socketPlugin);
await server.register(authRoutes, { prefix: '/api/v1/auth' });
await server.register(characterRoutes, { prefix: '/api/v1/characters' });
await server.register(zoneRoutes, { prefix: '/api/v1/zones' });
await server.register(questRoutes, { prefix: '/api/v1/quest' });
await server.register(adminRoutes, {prefix: '/api/v1/admin' });
await server.register(guildRoutes, {prefix: '/api/v1/guilds' });

startWorldEventsWorker(server.io);

server.get('/health', async () => ({ status: 'ok' }));

try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (err) {
    server.log.error(err);
    process.exit(1);
}