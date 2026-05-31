import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { CHARACTER_LIMITS } from '@aether/shared';

function httpError(message: string, statusCode: number): Error & { statusCode: number } {
    const err = new Error(message) as Error & { statusCode: number };
    err.statusCode = statusCode;
    return err;
}

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
    if (!character) throw httpError('Character not found', 404);
    if (character.level < CHARACTER_LIMITS.guildFoundMinLevel) {
        throw httpError(`Character must be level ${CHARACTER_LIMITS.guildFoundMinLevel} to found a guild`, 400);
    }
    if (character.gold < CHARACTER_LIMITS.guildFoundGoldCost) {
        throw httpError(`Founding a guild costs ${CHARACTER_LIMITS.guildFoundGoldCost} gold`, 400);
    }
    if (character.guildMembership) {
        throw httpError('Character is already in a guild', 400);
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
    if (!guild) throw httpError('Guild not found', 404);
    return guild;
}

export async function joinGuild(userId: string, characterId: string, guildId: string) {
    const character = await prisma.character.findFirst({
        where: { id: characterId, userId, deletedAt: null },
        include: { guildMembership: true },
    });
    if (!character) throw httpError('Character not found', 404);
    if (character.guildMembership) throw httpError('Already in a guild', 400);

    const guild = await prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) throw httpError('Guild not found', 404);

    return prisma.guildMember.create({
        data: { guildId, characterId, role: 'MEMBER' },
        include: { guild: true },
    });
}

export async function leaveGuild(userId: string, characterId: string, guildId: string) {
    const membership = await prisma.guildMember.findFirst({
        where: { characterId, guildId, character: { userId } },
    });
    if (!membership) throw httpError('Not a member of this guild', 404);
    if (membership.role === 'MASTER') {
        throw httpError('Guild master must disband the guild or transfer leadership', 400);
    }
    return prisma.guildMember.delete({ where: { guildId_characterId: { guildId, characterId } } });
}

export async function kickMember(userId: string, actorCharId: string, guildId: string, targetCharId: string) {
    const actor = await prisma.guildMember.findFirst({
        where: { characterId: actorCharId, guildId, character: { userId } },
    });
    if (!actor || (actor.role !== 'MASTER' && actor.role !== 'OFFICER')) {
        throw httpError('Insufficient permissions', 403);
    }
    const target = await prisma.guildMember.findFirst({ where: { characterId: targetCharId, guildId } });
    if (!target) throw httpError('Member not found', 404);
    if (target.role === 'MASTER') throw httpError('Cannot kick the guild master', 400);

    return prisma.guildMember.delete({ where: { guildId_characterId: { guildId, characterId: targetCharId } } });
}

export async function disbandGuild(userId: string, characterId: string, guildId: string) {
    const membership = await prisma.guildMember.findFirst({
        where: { characterId, guildId, role: 'MASTER', character: { userId } },
    });
    if (!membership) throw httpError('Only the guild master can disband', 403);

    return prisma.$transaction([
        prisma.guildMember.deleteMany({ where: { guildId } }),
        prisma.guild.delete({ where: { id: guildId } }),
    ]);
}
