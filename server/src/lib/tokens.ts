import jwt from 'jsonwebtoken';
import { env } from './env.js';
import type { AuthUser } from '@aether/shared';

export function signAccessToken(user: AuthUser): string {
    return jwt.sign(user, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function signRefreshToken(userId: string): string {
    return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyRefreshToken(token: string): { userId: string } {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string };
}