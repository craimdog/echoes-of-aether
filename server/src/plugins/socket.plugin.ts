import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import { env } from '../lib/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

const socketPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const io = new Server(fastify.server, {
    cors: { origin: env.CLIENT_URL, credentials: true },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  fastify.decorate('io', io);

  // Track presence: zoneId -> Set of { socketId, characterName }
  const zonePresence = new Map<string, Map<string, string>>();

  io.on('connection', (socket) => {
    fastify.log.info({ socketId: socket.id }, 'Socket connected');

    socket.on('zone:join', ({ zoneId, characterName }: { zoneId: string; characterName: string }) => {
      socket.join(`zone:${zoneId}`);
      socket.data.zoneId = zoneId;
      socket.data.characterName = characterName;

      if (!zonePresence.has(zoneId)) zonePresence.set(zoneId, new Map());
      zonePresence.get(zoneId)!.set(socket.id, characterName);

      const names = [...(zonePresence.get(zoneId)?.values() ?? [])];
      io.to(`zone:${zoneId}`).emit('zone:presence', { zoneId, characters: names });
    });

    socket.on('zone:chat', (payload: { zoneId: string; characterName: string; message: string }) => {
      io.to(`zone:${payload.zoneId}`).emit('zone:chat:message', {
        characterName: payload.characterName,
        message: payload.message,
        timestamp: Date.now(),
      });
    });

    socket.on('quest:join', (sessionId: string) => {
      socket.join(`quest:${sessionId}`);
    });

    socket.on('disconnect', () => {
      const { zoneId, characterName } = socket.data as { zoneId?: string; characterName?: string };
      if (zoneId && zonePresence.has(zoneId)) {
        zonePresence.get(zoneId)!.delete(socket.id);
        const names = [...(zonePresence.get(zoneId)?.values() ?? [])];
        io.to(`zone:${zoneId}`).emit('zone:presence', { zoneId, characters: names });
      }
      fastify.log.info({ socketId: socket.id }, 'Socket disconnected');
    });
  });
};

export default fp(socketPlugin);
