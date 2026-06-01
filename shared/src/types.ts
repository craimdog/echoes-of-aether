export type Role = 'PLAYER' | 'ADMIN';
export type Class = 'MAGE' | 'RANGER' | 'PALADIN' | 'ROGUE';
export type GuildRole = 'MASTER' | 'OFFICER' | 'MEMBER';
export type QuestStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ABANDONED';

export type WorldMutationType =
    | 'FACTION_SHIFT'
    | 'ZONE_THREAT_CHANGE'
    | 'LORE_FRAGMENT'
    | 'QUEST_COMPLETE'
    | 'ITEM_PICKUP'
    | 'HP_CHANGE';

export interface AuthUser {
    id: string;
    email: string;
    username: string;
    role: Role;
}

export interface ApiResponse<T> {
    success: true;
    data: T;
}

export interface ApiError {
    success: false;
    error: string;
    code: string;
}

export interface WorldMutation {
    type: WorldMutationType;
    zoneId: string;
    payload: Record<string, unknown>;
}

// Socket.io payload types
export interface ZoneChatPayload {
    zoneId: string;
    characterName: string;
    message: string;
}

export interface QuestInputPayload {
    sessionId: string;
    input: string;
}

export interface QuestChunkPayload {
    sessionId: string;
    chunk: string;
}

export interface QuestEndPayload {
    sessionId: string;
    mutation?: WorldMutation;
}

export interface ZoneEventPayload {
    zoneId: string;
    description: string;
    triggeredBy?: string;
}

export interface WorldEventPayload {
    description: string;
    zoneId: string;
    zoneName: string;
}