import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import * as authService from '../services/auth.service.js';

const registerSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
    password: z.string().min(8),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

const isProd = process.env.NODE_ENV === 'production';

const cookieOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
};

const authRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.post('/register', async (req, reply) => {
        const body = registerSchema.parse(req.body);
        const { accessToken, refreshToken, user } = await authService.register(
            body.email, body.username, body.password
        );
        reply
            .setCookie('access_token', accessToken, { ...cookieOpts, maxAge: 60 * 15 })
            .setCookie('refresh_token', refreshToken, { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 })
            .send({ success: true, data: { user } });
    });

    fastify.post('/login', async (req, reply) => {
        const body = loginSchema.parse(req.body);
        const { accessToken, refreshToken, user } = await authService.login(body.email, body.password);
        reply
            .setCookie('access_token', accessToken, { ...cookieOpts, maxAge: 60 * 15 })
            .setCookie('refresh_token', refreshToken, { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 })
            .send({ success: true, data: { user } });
    });

    fastify.post('/refresh', async (req, reply) => {
        const token = req.cookies['refresh_token'];
        if (!token) return reply.status(401).send({ success: false, error: 'No refresh token', code: 'UNAUTHORIZED' });
        const { accessToken, refreshToken, user } = await authService.refresh(token);
        reply
            .setCookie('access_token', accessToken, { ...cookieOpts, maxAge: 60 * 15 })
            .setCookie('refresh_token', refreshToken, { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 })
            .send({ success: true, data: { user } });
    });

    fastify.post('/logout', { preHandler: [fastify.authenticate] }, async (req, reply) => {
        await authService.logout(req.user.id);
        reply
            .clearCookie('access_token', { path: '/' })
            .clearCookie('refresh_token', { path: '/' })
            .send({ success: true, data: null });
    });

    fastify.get('/me', {preHandler: [fastify.authenticate] }, async (req, reply) => {
        reply.send({ success: true, data: { user: req.user } });
    });
};

export default authRoutes;