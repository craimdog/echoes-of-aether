import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preHandler', fastify.authenticate);
    fastify.addHook('preHandler', fastify.requireAdmin);

    // Overview stats
    fastify.get('/stats', async () => {
        const [users, characters, zones, activeSessions, worldEvents] = await Promise.all([
            prisma.user.count(),
            prisma.character.count({ where: {deletedAt: null } }),
            prisma.zone.count(),
            prisma.questSession.count({ where: { status: 'ACTIVE' } }),
            prisma.worldEvent.count(),
        ]);
        const connectedSockets = fastify.io.engine.clientsCount;
        return { success: true, data: { users, characters, zones, activeSessions, worldEvents, connectedSockets } };
    });

    // All zones with full state
    fastify.get('/zones', async () => {
        const zones = await prisma.zone.findMany({
            include: {
                faction: true,
                _count: { select: { characters: true, worldEvents: true, loreFragments: true } },
            },
            orderBy: { name: 'asc' },
        });
        return { success: true, data: { zones } };
    });

    // Faction standings
    fastify.get('/factions', async () => {
        const factions = await prisma.faction.findMany({
            include: { _count: { select: { characters: true, zones: true } } },
            orderBy: { globalPower: 'desc' },
        });
        return { success: true, data: { factions } };
    });

    // Recent world events
    fastify.get('/events', async () => {
        const events = await prisma.worldEvent.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                zone: { select: { name: true } },
                triggeredBy: { select: { name: true } },
            },
        });
        return { success: true, data: { events } };
    });

    // All characters
    fastify.get('/characters', async () => {
        const characters = await prisma.character.findMany({
            where: { deletedAt: null },
            include: {
                user: { select: { username: true, email: true } },
                zone: { select: { name: true } },
                faction: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return { success: true, data: { characters } };
    });

    // Manually trigger a world event
    fastify.post('/events', async (req, reply) => {
        const body = z.object({
            zoneId: z.string().min(1),
            description: z.string().min(1),
        }).parse(req.body);

        const event = await prisma.worldEvent.create({
            data: { zoneId: body.zoneId, description: body.description, processed: true },
            include: { zone: { select: { name: true } } },
        });

        fastify.io.emit('world:event', {
            description: event.description,
            zoneId: event.zoneId,
            zoneName: event.zone.name,
        });

        return reply.status(201).send({ success: true, data: { event } });
    });

    // Reset a zone's threat level
    fastify.post('/zones/:id/reset', async (req, reply) => {
        const { id } = req.params as { id: string };
        const zone = await prisma.zone.update({
            where: { id },
            data: { threatLevel: 1, factionControlId: null },
        });
        return reply.send({ success: true, data: { zone } });
    });

    // Promote user to admin (dev utility)
    fastify.post('/user/:id/promote', async (req, reply) => {
        const { id } = req.params as { id: string };
        const user = await prisma.user.update({
            where: { id },
            data: { role: 'ADMIN' },
            select: { id: true, username: true, role: true },
        });
        return reply.send({ success: true, data: { user } });
    });
};

export default adminRoutes;