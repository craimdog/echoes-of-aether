import { prisma } from '../lib/prisma.js';
import { CHARACTER_LIMITS } from '@aether/shared';

export async function createGuild(
    userId: string,
    characterId: string,
    name: string,
    emblemColor: string,
    description: string,
) {
    const character = await prisma.character.findFirst({
        where: { id: characterId, userId, deletedAt: null, isAlive: true },
        include: { guildMembership: true },
    });
    if (!character) throw Object.assign(new Error('Character not found'), { statusCode: 404 });
    if (character.level < CHARACTER_LIMITS.guildFoundMinLevel) {
        throw Object.assign(new Error(`Character must be level ${CHARACTER_LIMITS.guildFoundMinLevel} to found a guild`), { statusCode: 400 });
    }
    if (character.gold < CHARACTER_LIMITS.guildFoundGoldCost) {
        throw Object.assign(new Error(`Founding a guild costs ${CHARACTER_LIMITS.guildFoundGoldCost} gold`), { statusCode: 400 });
    }
    if (character.guildMembership) {
        throw Object.assign(new Error('Character is already in a guild'), { statusCode: 400 });
    }

    return prisma.$transaction(async (tx) => {
        const guild = await tx.guild.create({
            data: {
                name,
                emblemColor,
                description,
                founderId: characterId,
                members: {
                    create: { characterId, role: 'MASTER' },
                },
            },
            include: { members: { include: { character: true } } },
        });
        await tx.character.update({
            where: { id: characterId },
            data: { gold: { decrement: CHARACTER_LIMITS.guildFoundGoldCost } },
        });
        return guild;
    });
}

export async function listGuilds() {
    return prisma.guild.findMany({
        include: {
            _count: { select: { members: true } },
        },
        orderBy: { xpPool: 'desc' },
    });
}

export async function getGuild(id: string) {
    const guild = await prisma.guild.findUnique({
        where: { id },
        include: {
            members: {
                include: { character: { include: { zone: true } } },
                orderBy: { joinedAt: 'asc' },
            },
        },
    });
    if (!guild) throw Object.assign(new Error('Guild not found'), { statusCode: 404 });
    return guild;
}

export async function joinGuild(userId: string, characterId: string, guildId: string) {
    const character = await prisma.character.findFirst({
        where: { id: characterId, userId, deletedAt: null },
        include: { guildMembership: true },
    });
    if (!character) throw Object.assign(new Error('Character not found'), { statusCode: 404 });
    if (character.guildMembership) throw Object.assign(new Error('Already in a guild'), { statusCode: 400 });

    const guild = await prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) throw Object.assign(new Error('Guild not found'), { statusCode: 404 });

    return prisma.guildMember.create({
        data: { guildId, characterId, role: 'MEMBER' },
        include: { guild: true },
    });
}

export async function leaveGuild(userId: string, characterId: string, guildId: string) {
    const membership = await prisma.guildMember.findFirst({
        where: { characterId, guildId, character: { userId } },
    });
    if (!membership) throw Object.assign(new Error('Not a member of this guild'), { statusCode: 404 });
    if (membership.role === 'MASTER') {
        throw Object.assign(new Error('Guild master must disband the guild or transfer leadership'), { statusCode: 400 });
    }
    return prisma.guildMember.delete({ where: { guildId_characterId: { guildId, characterId } } });
}

export async function kickMember(userId: string, actorCharId: string, guildId: string, targetCharId: string) {
    const actor = await prisma.guildMember.findFirst({
        where: { characterId: actorCharId, guildId, character: { userId } },
    });
    if (!actor || (actor.role !== 'MASTER' && actor.role !== 'OFFICER')) {
        throw Object.assign(new Error('Insufficient permissions'), { statusCode: 403 });
    }
    const target = await prisma.guildMember.findFirst({ where: { characterId: targetCharId, guildId } });
    if (!target) throw Object.assign(new Error('Member not found'), { statusCode: 404 });
    if (target.role === 'MASTER') throw Object.assign(new Error('Cannot kick the guild master'), { statusCode: 400 });

    return prisma.guildMember.delete({ where: { guildId_characterId: { guildId, characterId: targetCharId } } });
}

export async function disbandGuild(userId: string, characterId: string, guildId: string) {
    const membership = await prisma.guildMember.findFirst({
        where: { characterId, guildId, role: 'MASTER', character: { userId } },
    });
    if (!membership) throw Object.assign(new Error('Only the guild master can disband'), { statusCode: 403 });

    return prisma.$transaction([
        prisma.guildMember.deleteMany({ where: { guildId } }),
        prisma.guild.delete({ where: { id: guildId } }),
    ]);
}