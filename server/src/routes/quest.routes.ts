import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as questService from '../services/quest.service.js';
import { streamQuestResponse, getSessionMessages } from '../services/ai.service.js';
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

    const charMeta = await prisma.character.findFirst({ where: { id: characterId }, select: { zoneId: true } });

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
            where: { zoneId: charMeta?.zoneId ?? '' },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { description: true, createdAt: true },
        }),
        charMeta ? getRelevantLore(charMeta.zoneId, questId) : Promise.resolve([]),
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
    ).then(async ({ fullText, mutation }) => {
        // Apply character mutations synchronously so sidebar updates immediately
        if (mutation && characterId) {
            const { type, payload } = mutation;
            if (type === 'QUEST_COMPLETE') {
                const p = payload as { xpGained?: number; goldGained?: number };
                if (p.xpGained || p.goldGained) {
                    const updated = await prisma.character.update({
                        where: { id: characterId },
                        data: {
                            xp: { increment: p.xpGained ?? 0 },
                            gold: { increment: p.goldGained ?? 0 },
                        },
                    });
                    const xpForNext = updated.level * 150;
                    if (updated.xp >= xpForNext) {
                        const CLASS_BASE: Record<string, { hp: number; mp: number }> = {
                            MAGE: { hp: 60, mp: 120 }, RANGER: { hp: 80, mp: 60 },
                            PALADIN: { hp: 120, mp: 40 }, ROGUE: { hp: 70, mp: 50 },
                        };
                        const base = CLASS_BASE[updated.class] ?? { hp: 10, mp: 10 };
                        await prisma.character.update({
                            where: { id: characterId },
                            data: { level: { increment: 1 }, hp: { increment: Math.floor(base.hp * 0.1) }, mp: { increment: Math.floor(base.mp * 0.1) } },
                        });
                    }
                }
            } else if (type === 'ITEM_PICKUP') {
                const p = payload as { item?: string; items?: string[] };
                const items = p.items ?? (p.item ? p.item.split(',').map(s => s.trim()).filter(Boolean) : []);
                if (items.length) {
                    const char = await prisma.character.findUnique({ where: { id: characterId }, select: { inventory: true } });
                    const inv = Array.isArray(char?.inventory) ? char.inventory as string[] : [];
                    const newItems = items.filter(i => !inv.includes(i));
                    if (newItems.length) await prisma.character.update({ where: { id: characterId }, data: { inventory: [...inv, ...newItems] } });
                }
            } else if (type === 'HP_CHANGE') {
                const { delta } = payload as { delta: number };
                if (typeof delta === 'number') {
                    const char = await prisma.character.findUnique({ where: { id: characterId }, select: { hp: true } });
                    if (char) await prisma.character.update({ where: { id: characterId }, data: { hp: Math.max(0, char.hp + delta), isAlive: Math.max(0, char.hp + delta) > 0 } });
                }
            }
        }

        fastify.io.to(`quest:${sessionId}`).emit(SOCKET_EVENTS.QUEST_END, { sessionId, mutation, cleanText: fullText });

        // Queue world-state mutations for async processing
        if (mutation && ['FACTION_SHIFT', 'ZONE_THREAT_CHANGE', 'LORE_FRAGMENT'].includes(mutation.type)) {
            await worldEventsQueue.add('world-mutation', { mutation, triggeredByCharId: characterId });
        }
    }).catch((err) => {
      fastify.log.error(err, 'Quest stream error');
      fastify.io.to(`quest:${sessionId}`).emit(SOCKET_EVENTS.QUEST_END, { sessionId, mutation: null, cleanText: null });
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
        include: {
          quest: { include: { zone: { include: { faction: true } } } },
        },
    });
    if (!session) return reply.status(404).send({ success: false, error: 'Session not found', code: 'NOT_FOUND' });
    return reply.send({ success: true, data: session });
  });

  fastify.get('/:sessionId/messages', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const messages = await getSessionMessages(sessionId);
    return reply.send({ success: true, data: { messages } });
  });
};

export default questRoutes;
