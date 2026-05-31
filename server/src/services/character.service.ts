import { prisma } from '../lib/prisma.js';
import type { Class } from '@aether/shared';
import { CHARACTER_LIMITS } from '@aether/shared';

const CLASS_STATS: Record<Class, { hp: number, mp: number }> = {
    MAGE: { hp: 60, mp: 120 },
    RANGER: { hp: 80, mp: 60 },
    PALADIN: { hp: 120, mp: 40 },
    ROGUE: { hp: 70, mp: 50 },
};

export async function getCharacters(userId: string) {
    return prisma.character.findMany({
        where: { userId, deletedAt: null },
        include: { zone: true, faction: true },
    });
}

export async function getCharacter(id: string, userId: string) {
    const character = await prisma.character.findFirst({
        where: { id, userId, deletedAt: null },
        include: { zone: true, faction: true, guildMembership: { include: { guild: true } } },
    });
    if (!character) {
        throw Object.assign(new Error('Character not found'), { statusCode: 404 });
    }
    return character;
}

export async function createCharacter(userId: string, name: string, characterClass: Class, zoneId: string) {
    const count = await prisma.character.count({ where: { userId, deletedAt: null } });
    if (count >= CHARACTER_LIMITS.maxPerAccount) {
        throw Object.assign(
            new Error(`Maximum ${CHARACTER_LIMITS.maxPerAccount} characters per account`),
            { statusCode: 400 }
        );
    }

    const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) {
        throw Object.assign(new Error('Zone not found'), { statusCode: 404 });
    }

    const stats = CLASS_STATS[characterClass];
    return prisma.character.create({
        data: { userId, name, class: characterClass, zoneId, ...stats },
        include: { zone: true },
    });
}

export async function deleteCharacter(id: string, userId: string) {
    const character = await prisma.character.findFirst({
        where: { id, userId, deletedAt: null },
    });
    if (!character) {
        throw Object.assign(new Error('Character not found'), { statusCode: 404 });
    }
    return prisma.character.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
}