import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as characterService from '../services/character.service.js';

const createSchema = z.object({
    name: z.string().min(2).max(30),
    class: z.enum(['MAGE', 'RANGER', 'PALADIN', 'ROGUE']),
    zoneId: z.string().cuid(),
});

const characterRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.get('/', async (req) => {
        const characters = await characterService.getCharacters(req.user.id);
        return { success: true, data: { characters } };
    });

    fastify.get('/:id', async (req) => {
        const { id } = req.params as { id: string };
        const character = await characterService.getCharacter(id, req.user.id);
        return { success: true, data: { character } };
    });

    fastify.post('/', async (req, reply) => {
        const body = createSchema.parse(req.body);
        const character = await characterService.createCharacter(
            req.user.id, body.name, body.class, body.zoneId
        );
        return reply.status(201).send({ success: true, data: { character } });
    });

    fastify.delete('/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        await characterService.deleteCharacter(id, req.user.id);
        return reply.status(204).send();
    });
};

export default characterRoutes;