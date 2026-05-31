import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';

const zoneRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/', async () => {
        const zones = await prisma.zone.findMany({
            include: { faction: true, _count: { select: { characters: true, quests: true } } },
            orderBy: { name: 'asc'},
        });
        return { success: true, data: { zones } };
    });

    fastify.get('/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const zone = await prisma.zone.findUnique({
            where: { id },
            include: {
                faction: true, 
                quests: { where: { isActive: true } },
                worldEvents: { orderBy: { createdAt: 'desc' }, take: 10 },
                _count: { select: { characters: true } },
            },
        });
        if (!zone) return reply.status(404).send({ success: false, error: 'Zone not found', code:'NOT_FOUND' });
        return { success: true, data: { zone } };
    });

    fastify.get('/:id/quests', async (req, reply) => {
        const { id } = req.params as { id: string };
        const quests = await prisma.quest.findMany({
            where: { zoneId: id, isActive: true },
            orderBy: { rewardXp: 'asc' },
        });
        return { success: true, data: { quests } };
    });

    // Recent world events across all zone (for the world feed)
    fastify.get('/world-events', async () => {
        const events = await prisma.worldEvent.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { zone: { select: { name: true } } },
        });
        return { success: true, data: { events } };
    });
};

export default zoneRoutes;