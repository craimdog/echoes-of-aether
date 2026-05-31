import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as questService from '../services/quest.service.js';
import { streamQuestResponse } from '../services/ai.service.js';
import { prisma } from '../lib/prisma.js';
import { buildSystemPrompt } from '../services/prompt-builder.js';
import { SOCKET_EVENTS } from '@aether/shared';
import { worldEventsQueue } from '../lib/queues.js';
import { getRelevantLore } from '../services/lore.service.js';

const startSchema = z.object({
  characterId: z.string().min(1),
  questId: z.string().min(1),
});

const inputSchema = z.object({
  sessionId: z.string().min(1),
  characterId: z.string().min(1),
  questId: z.string().min(1),
  input: z.string().min(1).max(500),
});

const questRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post('/start', async (req, reply) => {
    const { characterId, questId } = startSchema.parse(req.body);
    const session = await questService.startQuestSession(characterId, questId);
    return reply.send({ success: true, data: { sessionId: session.sessionId } });
  });

  fastify.post('/input', async (req, reply) => {
    const { sessionId, characterId, questId, input } = inputSchema.parse(req.body);

    const [character, quest, recentEvents, loreFragments] = await Promise.all([
        prisma.character.findFirst({
            where: { id: characterId, deletedAt: null },
            include: { zone: { include: { faction: true } }, faction: true },
        }),
        prisma.quest.findFirst({
            where: { id: questId },
            include: { zone: true },
        }),
        prisma.worldEvent.findMany({
            where: { zoneId: (await prisma.character.findFirst({ where: { id: characterId }, select: { zoneId: true } }))?.zoneId ?? '' },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { description: true, createdAt: true },
        }),
        prisma.character.findFirst({ where: { id: characterId }, select: { zoneId: true } })
            .then(c => c ? getRelevantLore(c.zoneId, quest?.title ?? '') : []),
    ]);

    if (!character || !quest) {
        return reply.status(404).send({ success: false, error: 'Character or quest not found', code: 'NOT_FOUND' });
    }

    const systemPrompt = buildSystemPrompt(character, quest, recentEvents, loreFragments);

    reply.send({ success: true, data: { streaming: true } });

    streamQuestResponse(
      sessionId,
      systemPrompt,
      input,
      (chunk) => {
        fastify.io.to(`quest:${sessionId}`).emit(SOCKET_EVENTS.QUEST_CHUNK, { sessionId, chunk });
      },
    ).then(async ({ mutation }) => {
        fastify.io.to(`quest:${sessionId}`).emit(SOCKET_EVENTS.QUEST_END, { sessionId, mutation });
        if (mutation) {
            await worldEventsQueue.add('world-mutation', {
                mutation,
                triggeredByCharId: characterId,
            });
        }
    }).catch((err) => {
      fastify.log.error(err, 'Quest stream error');
    });
  });

  fastify.post('/end', async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(req.body);
    await questService.endQuestSession(sessionId);
    return reply.send({ success: true, data: null });
  });

  fastify.get('/:sessionId', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const session = await prisma.questSession.findUnique({
        where: { id: sessionId },
        select: { questId: true, status: true },
    });
    if (!session) return reply.status(404).send({ success: false, error: 'Session not found', code: 'NOT_FOUND' });
    return reply.send({ success: true, data: session });
  });
};

export default questRoutes;
