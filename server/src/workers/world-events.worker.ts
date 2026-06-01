import { Worker } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import type { WorldMutationJobData } from '../jobs/world-mutation.job.js';
import type { Server } from 'socket.io';
import { generateQuest } from '../services/ai.service.js';

const CLASS_HP_MP: Record<string, { hp: number; mp: number }> = {
  MAGE:    { hp: 60,  mp: 120 },
  RANGER:  { hp: 80,  mp: 60  },
  PALADIN: { hp: 120, mp: 40  },
  ROGUE:   { hp: 70,  mp: 50  },
};

function getConnection() {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      tls: url.protocol === 'rediss:' ? ({} as object) : undefined,
    };
  }
  return { host: 'localhost', port: 6379 };
}

function describeMutation(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case 'FACTION_SHIFT':      return `Faction control shifted in this zone.`;
    case 'ZONE_THREAT_CHANGE': return `Zone threat level changed to ${payload.threatLevel}.`;
    case 'LORE_FRAGMENT':      return `New lore: ${String(payload.content ?? '')}`;
    case 'QUEST_COMPLETE':     return `A quest was completed.`;
    default:                   return `World event: ${type}`;
  }
}

export function startWorldEventsWorker(io: Server) {
  const worker = new Worker<WorldMutationJobData>(
    'world-events',
    async (job) => {
      const { mutation, triggeredByCharId } = job.data;
      const { type, zoneId, payload } = mutation;

      const zone = await prisma.zone.findUnique({ where: { id: zoneId }, select: { name: true } });

      const worldEvent = await prisma.worldEvent.create({
        data: {
          zoneId,
          description: describeMutation(type, payload),
          triggeredByCharId: triggeredByCharId ?? null,
          processed: false,
        },
      });

      // Broadcast to world feed
      io.emit('world:event', {
        description: worldEvent.description,
        zoneId,
        zoneName: zone?.name ?? 'Unknown',
      });

      switch (type) {
        case 'FACTION_SHIFT': {
          const { factionId } = payload as { factionId: string };
          const updatedZone = await prisma.zone.update({
            where: { id: zoneId },
            data: { factionControlId: factionId ?? null },
            include: { faction: true },
          });
          // Generate a new quest spawned by this faction shift
          const newFaction = await prisma.faction.findUnique({ where: { id: factionId } });
          const quest = await generateQuest(
            updatedZone.name, updatedZone.lore, updatedZone.threatLevel,
            newFaction?.name ?? null, worldEvent.description,
          );
          if (quest) {
            await prisma.quest.create({
              data: { zoneId, title: quest.title, briefing: quest.briefing, rewardXp: quest.rewardXp, rewardGold: quest.rewardGold },
            });
          }
          break;
        }
        case 'ZONE_THREAT_CHANGE': {
          const { threatLevel } = payload as { threatLevel: number };
          if (typeof threatLevel === 'number' && threatLevel >= 1 && threatLevel <= 5) {
            const updatedZone = await prisma.zone.update({
              where: { id: zoneId },
              data: { threatLevel },
              include: { faction: true },
            });
            // Generate a new quest reflecting the changed threat level
            const quest = await generateQuest(
              updatedZone.name, updatedZone.lore, threatLevel,
              updatedZone.faction?.name ?? null, worldEvent.description,
            );
            if (quest) {
              await prisma.quest.create({
                data: { zoneId, title: quest.title, briefing: quest.briefing, rewardXp: quest.rewardXp, rewardGold: quest.rewardGold },
              });
            }
          }
          break;
        }
        case 'LORE_FRAGMENT': {
          const { content } = payload as { content: string };
          if (content) {
            const existing = await prisma.loreFragment.findFirst({
              where: { zoneId, content },
            });
            if (!existing) {
              await prisma.loreFragment.create({ data: { zoneId, content } });
            }
          }
          break;
        }
        case 'QUEST_COMPLETE': {
          const { sessionId, xpGained, goldGained } = payload as {
            sessionId?: string;
            xpGained?: number;
            goldGained?: number;
          };
          if (sessionId) {
            await prisma.questSession.updateMany({
              where: { id: sessionId, status: 'ACTIVE' },
              data: { status: 'COMPLETED', endedAt: new Date() },
            });
          }
          if ((xpGained || goldGained) && triggeredByCharId) {
            const updated = await prisma.character.update({
              where: { id: triggeredByCharId },
              data: {
                xp: { increment: xpGained ?? 0 },
                gold: { increment: goldGained ?? 0 },
              },
            });

            const xpForNextLevel = updated.level * 150;
            if (updated.xp >= xpForNextLevel) {
              const stats = CLASS_HP_MP[updated.class] ?? { hp: 10, mp: 10 };
              await prisma.character.update({
                where: { id: triggeredByCharId },
                data: {
                  level: { increment: 1 },
                  hp: { increment: Math.floor(stats.hp * 0.1) },
                  mp: { increment: Math.floor(stats.mp * 0.1) },
                },
              });
            }
          }
          break;
        }
        case 'ITEM_PICKUP': {
          const p = payload as { item?: string; items?: string[] };
          // Support both single item string and items array
          const rawItems: string[] = p.items
            ? p.items
            : p.item
              ? p.item.split(',').map(s => s.trim()).filter(Boolean)
              : [];
          if (rawItems.length && triggeredByCharId) {
            const character = await prisma.character.findUnique({
              where: { id: triggeredByCharId },
              select: { inventory: true },
            });
            const inventory = Array.isArray(character?.inventory) ? character.inventory as string[] : [];
            const newItems = rawItems.filter(i => !inventory.includes(i));
            if (newItems.length) {
              await prisma.character.update({
                where: { id: triggeredByCharId },
                data: { inventory: [...inventory, ...newItems] },
              });
            }
          }
          break;
        }
        case 'HP_CHANGE': {
          const { delta } = payload as { delta: number };
          if (typeof delta === 'number' && triggeredByCharId) {
            const character = await prisma.character.findUnique({
              where: { id: triggeredByCharId },
              select: { hp: true },
            });
            if (character) {
              const newHp = Math.max(0, character.hp + delta);
              await prisma.character.update({
                where: { id: triggeredByCharId },
                data: { hp: newHp, isAlive: newHp > 0 },
              });
            }
          }
          break;
        }
      }

      await prisma.worldEvent.update({ where: { id: worldEvent.id }, data: { processed: true } });
    },
    { connection: getConnection() },
  );

  worker.on('failed', (job, err: Error) => {
    console.error(`World events job ${job?.id} failed:`, err.message);
  });

  return worker;
}
