import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as guildService from '../services/guild.service.js';

const createSchema = z.object({
    characterId: z.string().min(1),
    name: z.string().min(2).max(40),
    emblemColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    description: z.string().max(200).default(''),
});

const guildRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.get('/', async () => {
        const guilds = await guildService.listGuilds();
        return { success: true, data: { guilds } };
    });

    fastify.post('/', async (req, reply) => {
        const body = createSchema.parse(req.body);
        const guild = await guildService.createGuild(
            req.user.id, body.characterId, body.name, body.emblemColor, body.description,
        );
        return reply.status(201).send({ success: true, data: { guild } });
    });

    fastify.get('/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const guild = await guildService.getGuild(id);
        return reply.send({ success: true, data: { guild } });
    });

    fastify.post('/:id/join', async (req, reply) => {
        const { id } = req.params as { id: string };
        const { characterId } = z.object({ characterId: z.string().min(1) }).parse(req.body);
        const membership = await guildService.joinGuild(req.user.id, characterId, id);
        return reply.send({ success: true, data: { membership } });
    });

    fastify.post('/:id/leave', async (req, reply) => {
        const { id } = req.params as { id: string };
        const { characterId } = z.object({ characterId: z.string().min(1) }).parse(req.body);
        await guildService.leaveGuild(req.user.id, characterId, id);
        return reply.send({ success: true, data: null });
    });

    fastify.post('/:id/kick', async (req, reply) => {
        const { id } = req.params as { id: string };
        const { actorCharId, targetCharId } = z.object({
            actorCharId: z.string().min(1),
            targetCharId: z.string().min(1),
        }).parse(req.body);
        await guildService.kickMember(req.user.id, actorCharId, id, targetCharId);
        return reply.send({ success: true, data: null });
    });

    fastify.delete('/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const { characterId } = z.object({ characterId: z.string().min(1) }).parse(req.body);
        await guildService.disbandGuild(req.user.id, characterId, id);
        return reply.status(204).send();
    });
};

export default guildRoutes;