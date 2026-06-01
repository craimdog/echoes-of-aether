import { anthropic } from '../lib/anthropic.js';
import { redis } from '../lib/redis.js';
import type { WorldMutation } from '@aether/shared';

const QUEST_SESSION_TTL = 60 * 60 * 2;
const sessionKey = (id: string) => `quest-session:${id}`;

type Message = { role: 'user' | 'assistant'; content: string };

export async function getSessionMessages(sessionId: string): Promise<Message[]> {
    const raw = await redis.get(sessionKey(sessionId));
    return raw ? (JSON.parse(raw) as Message[]) : [];
}

export async function saveSessionMessages(sessionId: string, messages: Message[]) {
    await redis.set(
        sessionKey(sessionId),
        JSON.stringify(messages),
        'EX',
        QUEST_SESSION_TTL,
    );
}

export function extractMutation(text: string): { clean: string; mutation: WorldMutation | null } {
    const startMarker = '```json';
    const endMarker = '```';

    const startIdx = text.indexOf(startMarker);
    if (startIdx === -1) return { clean: text, mutation: null };

    const jsonStart = startIdx + startMarker.length;
    const endIdx = text.indexOf(endMarker, jsonStart);
    if (endIdx === -1) return { clean: text, mutation: null };

    const jsonStr = text.slice(jsonStart, endIdx).trim();
    const fullBlock = text.slice(startIdx, endIdx + endMarker.length);

    try {
        const parsed = JSON.parse(jsonStr) as { worldMutation: WorldMutation };
        if (!parsed.worldMutation) return { clean: text, mutation: null };
        return { clean: text.replace(fullBlock, '').trim(), mutation: parsed.worldMutation };
    } catch {
        return { clean: text, mutation: null };
    }
}

export async function streamQuestResponse(
    sessionId: string,
    systemPrompt: string,
    userInput: string,
    onChunk: (chunk: string) => void,
): Promise<{ fullText: string; mutation: WorldMutation | null }> {
    const history = await getSessionMessages(sessionId);
    history.push({ role: 'user', content: userInput });

    const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: history,
    });

    let fullText = '';
    let streamBuffer = '';
    let mutationStarted = false;
    const MUTATION_MARKER = '```json';
    const LOOKAHEAD = MUTATION_MARKER.length - 1;

    for await (const event of stream) {
        if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
        ) {
            const chunk = event.delta.text;
            fullText += chunk;

            if (mutationStarted) continue;

            streamBuffer += chunk;
            const mutIdx = streamBuffer.indexOf(MUTATION_MARKER);

            if (mutIdx !== -1) {
                mutationStarted = true;
                const safe = streamBuffer.slice(0, mutIdx).trimEnd();
                if (safe) onChunk(safe);
            } else if (streamBuffer.length > LOOKAHEAD) {
                onChunk(streamBuffer.slice(0, -LOOKAHEAD));
                streamBuffer = streamBuffer.slice(-LOOKAHEAD);
            }
        }
    }

    if (!mutationStarted && streamBuffer) onChunk(streamBuffer);

    const { clean, mutation } = extractMutation(fullText);
    history.push({ role: 'assistant', content: clean });

    // Keep last 20 turns to avoid context overflow
    const trimmed = history.slice(-20);
    await saveSessionMessages(sessionId, trimmed);

    return { fullText: clean, mutation };
}

export async function generateQuest(
    zoneName: string,
    zoneLore: string,
    threatLevel: number,
    factionName: string | null,
    triggerEvent: string,
): Promise<{ title: string; briefing: string; rewardXp: number; rewardGold: number } | null> {
    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 300,
            messages: [{
                role: 'user',
                content: `You are generating a new quest for a dark fantasy RPG zone.

Zone: ${zoneName}
Lore: ${zoneLore}
Threat Level: ${threatLevel}/5
Controlling Faction: ${factionName ?? 'None'}
Recent World Event: ${triggerEvent}

Generate a quest directly inspired by the world event above. Return ONLY valid JSON, no other text:
{"title":"...","briefing":"...","rewardXp":number,"rewardGold":number}

rewardXp should be 60-180, rewardGold should be 40-120. Make the briefing 1-2 sentences, atmospheric and specific to the event.`,
            }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
        return JSON.parse(text);
    } catch {
        return null;
    }
}