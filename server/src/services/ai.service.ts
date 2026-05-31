import { anthropic } from '../lib/anthropic.js';
import { redis } from '../lib/redis.js';
import type { WorldMutation } from '@aether/shared';

const QUEST_SESSION_TTL = 60 * 60 * 2;
const sessionKey = (id: string) => `quest-session:${id}`;

type Message = { role: 'user' | 'assistant'; content: string };

const MUTATION_REGEX = /```json\s*(\{[\s\S]*?"worldMutation"[\s\S]*?\})\s*```/;

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

export function extractMutation(text: string): { clean: string, mutation: WorldMutation | null } {
    const match = MUTATION_REGEX.exec(text);
    if (!match) return { clean: text, mutation: null };
    try {
        const parsed = JSON.parse(match[1]) as { worldMutation: WorldMutation };
        const clean = text.replace(match[0], '').trim();
        return { clean, mutation: parsed.worldMutation };
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
    for await (const event of stream) {
        if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
        ) {
            const chunk = event.delta.text;
            fullText += chunk;
            onChunk(chunk);
        }
    }

    const { clean, mutation } = extractMutation(fullText);
    history.push({ role: 'assistant', content: clean });

    // Keep last 20 turns to avoid context overflow
    const trimmed = history.slice(-20);
    await saveSessionMessages(sessionId, trimmed);

    return { fullText: clean, mutation };
}