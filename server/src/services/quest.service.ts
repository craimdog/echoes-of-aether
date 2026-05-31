import { prisma } from '../lib/prisma.js';
import { buildSystemPrompt } from './prompt-builder.js';
import { saveSessionMessages } from './ai.service.js';

export async function startQuestSession(characterId: string, questId: string) {
    const character = await prisma.character.findFirst({
        where: { id: characterId, deletedAt: null, isAlive: true },
        include: { zone: { include: { faction: true } }, faction: true },
    });
    if (!character) throw Object.assign(new Error('Character not found or unavailable'), { statusCode: 404 });

    const quest = await prisma.quest.findFirst({
        where: { id: questId, isActive: true },
        include: { zone: true },
    });
    if (!quest) throw Object.assign(new Error('Quest not found'), { statusCode: 404 });

    const recentEvents = await prisma.worldEvent.findMany({
        where: { zoneId: character.zoneId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { description: true, createdAt: true },
    });

    const session = await prisma.questSession.create({
        data: { characterId, questId, status: 'ACTIVE' },
    });

    const systemPrompt = buildSystemPrompt(character, quest, recentEvents);
    await saveSessionMessages(session.id, []);

    return { sessionId: session.id, systemPrompt, character, quest };
}

export async function endQuestSession(sessionId: string) {
    return prisma.questSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', endedAt: new Date() },
    });
}