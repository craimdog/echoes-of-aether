import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

declare module 'fastify' {
    interface FastifyInstance {
        requireAdmin: (req: any, reply: any) => Promise<void>;
    }
}

const adminPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.decorate('requireAdmin', async (req: any, reply: any) => {
        if (req.user?.role !== 'ADMIN') {
            return reply.status(403).send({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
        }
    });
};

export default fp(adminPlugin);