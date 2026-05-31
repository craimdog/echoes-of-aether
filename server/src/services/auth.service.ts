import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/tokens.js';
import type { AuthUser } from '@aether/shared';

const REFRESH_TOKEN_PREFIX = 'refresh:';

export async function register(email: string, username: string, password: string) {
    const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
    });
    if (existing) {
        throw Object.assign(new Error('Email or username already taken'), { statusCode: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
        data: { email, username, passwordHash },
    });

    return issueTokens({ id: user.id, email: user.email, username: user.username, role: user.role });
}

export async function login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    return issueTokens({ id: user.id, email: user.email, username: user.username, role: user.role });
}

export async function refresh(oldRefreshToken: string) {
    let payload: { userId: string };
    try {
        payload = verifyRefreshToken(oldRefreshToken);
    } catch {
        throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
    }

    const stored = await redis.get(`${REFRESH_TOKEN_PREFIX}${payload.userId}`);
    if (stored !== oldRefreshToken) {
        throw Object.assign(new Error('Refresh token reuse detected'), { statusCode: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
        throw Object.assign(new Error('User not found'), { statusCode: 401 });
    }

    return issueTokens({id: user.id, email: user.email, username: user.username, role: user.role });
}

export async function logout(userId: string) {
    await redis.del(`${REFRESH_TOKEN_PREFIX}${userId}`);
}

async function issueTokens(user: AuthUser) {
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user.id);
    await redis.set(`${REFRESH_TOKEN_PREFIX}${user.id}`, refreshToken, 'EX', 60 * 60 * 24 * 7);
    return { accessToken, refreshToken, user };
}