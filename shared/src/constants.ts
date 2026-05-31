// Socket.io even name contants - always import these, never use raw strings

export const SOCKET_EVENTS = {
    // Client -> Server
    ZONE_CHAT: 'zone:chat',
    QUEST_INPUT: 'quest:input',

    // Server -> Client
    ZONE_EVENT: 'zone:event',
    ZONE_CHAT_MESSAGE: 'zone:chat:message',
    ZONE_TYPING: 'zone:typing',
    ZONE_PRESENCE: 'zone:presence',
    WORLD_EVENT: 'world:event',
    QUEST_CHUNK: 'quest:chunk',
    QUEST_END: 'quest:end',
} as const;

export const SOCKET_ROOMS = {
    zone: (zoneId: string) => `zone:${zoneId}`,
    guild: (guildId:string) => `guild:${guildId}`,
    world: 'world',
} as const

export const QUEST_SESSION_TTL_SECONDS = 60 * 60 * 2; // 2 hours

export const CHARACTER_LIMITS = {
    maxPerAccount: 3,
    guildFoundMinLevel: 5,
    guildFoundGoldCost: 500,
} as const;

export const ZONE_LIMITS = {
    maxConcurrentUsers: 50,
} as const;