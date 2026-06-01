import { create } from 'zustand';

interface Message {
    role: 'player' | 'narrator';
    content: string;
    streaming?: boolean;
}

interface QuestState {
    sessionId: string | null;
    messages: Message[];
    streaming: boolean;
    setSession: (id: string) => void;
    clearSession: () => void;
    addPlayerMessage: (content: string) => void;
    startNarratorMessage: () => void;
    appendChunk: (chunk: string) => void;
    finalizeNarratorMessage: (cleanText?: string | null) => void;
}

export const useQuestStore = create<QuestState>((set) => ({
    sessionId: null,
    messages: [],
    streaming: false,

    setSession: (id) => set({ sessionId: id }),
    clearSession: () => set({ sessionId: null, messages: [], streaming: false }),

    addPlayerMessage: (content) =>
        set((s) => ({ messages: [...s.messages, { role: 'player', content }] })),

    startNarratorMessage: () =>
        set((s) => ({
            streaming: true,
            messages: [...s.messages, { role: 'narrator', content: '', streaming: true }],
        })),

    appendChunk: (chunk) =>
        set((s) => {
            const msgs = [...s.messages];
            const last = msgs[msgs.length - 1];
            if (last?.streaming) msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
            return { messages: msgs };
        }),

    finalizeNarratorMessage: (cleanText) =>
        set((s) => {
            const msgs = [...s.messages];
            const last = msgs[msgs.length - 1];
            if (last?.streaming) {
                msgs[msgs.length - 1] = {
                    ...last,
                    content: cleanText ?? last.content,
                    streaming: false,
                };
            }
            return { messages: msgs, streaming: false };
        }),
}));