import { Worker } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import type { WorldMutationJobData } from '../jobs/world-mutation.job.js';

const connection = { host: 'localhost', port: 6379 };

function describeMutation(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case 'FACTION_SHIFT':      return `Faction control shifted in this zone.`;
    case 'ZONE_THREAT_CHANGE': return `Zone threat level changed to ${payload.threatLevel}.`;
    case 'LORE_FRAGMENT':      return `New lore discovered: ${String(payload.content ?? '').slice(0, 80)}`;
    case 'QUEST_COMPLETE':     return `A quest was completed.`;
    default:                   return `World event: ${type}`;
  }
}

export function startWorldEventsWorker() {
  const worker = new Worker<WorldMutationJobData>(
    'world-events',
    async (job) => {
      const { mutation, triggeredByCharId } = job.data;
      const { type, zoneId, payload } = mutation;

      await prisma.worldEvent.create({
        data: {
          zoneId,
          description: describeMutation(type, payload),
          triggeredByCharId: triggeredByCharId ?? null,
          processed: false,
        },
      });

      switch (type) {
        case 'FACTION_SHIFT': {
          const { factionId } = payload as { factionId: string };
          await prisma.zone.update({
            where: { id: zoneId },
            data: { factionControlId: factionId ?? null },
          });
          break;
        }
        case 'ZONE_THREAT_CHANGE': {
          const { threatLevel } = payload as { threatLevel: number };
          if (typeof threatLevel === 'number' && threatLevel >= 1 && threatLevel <= 5) {
            await prisma.zone.update({ where: { id: zoneId }, data: { threatLevel } });
          }
          break;
        }
        case 'LORE_FRAGMENT': {
          const { content } = payload as { content: string };
          if (content) {
            await prisma.loreFragment.create({ data: { zoneId, content } });
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
            await prisma.character.update({
              where: { id: triggeredByCharId },
              data: {
                xp: { increment: xpGained ?? 0 },
                gold: { increment: goldGained ?? 0 },
              },
            });
          }
          break;
        }
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`World events job ${job?.id} failed:`, err.message);
  });

  return worker;
}
