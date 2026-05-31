import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../lib/env.js';
import type { AuthUser } from '@aether/shared';

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
    interface FastifyRequest {
        user: AuthUser;
    }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.decorate(
        'authenticate',
        async (req: FastifyRequest, reply: FastifyReply) => {
            const token = req.cookies['access_token'];
            if (!token) {
                return reply.status(401).send({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });
            }
            try {
                const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthUser;
                req.user = payload;
            } catch {
                return reply.status(401).send({ success: false, error: 'Invalid or expired token', code: 'TOKEN_INVALID'});
            }
        }
    );
};

export default fp(authPlugin);