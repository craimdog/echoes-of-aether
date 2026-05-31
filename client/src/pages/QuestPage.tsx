import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket, connectSocket } from '../lib/socket';
import { useQuestStore } from '../store/quest.store';
import { SOCKET_EVENTS } from '@aether/shared';

export default function QuestPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const characterId = searchParams.get('characterId') ?? '';
  const navigate = useNavigate();

  const { messages, streaming, setSession, addPlayerMessage, startNarratorMessage, appendChunk, finalizeNarratorMessage, clearSession } = useQuestStore();

  const [input, setInput] = useState('');
  const [questId, setQuestId] = useState('');
  const openingFired = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Socket setup — runs once on mount
  useEffect(() => {
    if (!sessionId) return;
    setSession(sessionId);

    const socket = getSocket();
    connectSocket();
    socket.emit('quest:join', sessionId);

    socket.on(SOCKET_EVENTS.QUEST_CHUNK, (payload: { sessionId: string; chunk: string }) => {
      if (payload.sessionId !== sessionId) return;
      appendChunk(payload.chunk);
    });

    socket.on(SOCKET_EVENTS.QUEST_END, (payload: { sessionId: string }) => {
      if (payload.sessionId !== sessionId) return;
      finalizeNarratorMessage();
    });

    return () => {
      socket.off(SOCKET_EVENTS.QUEST_CHUNK);
      socket.off(SOCKET_EVENTS.QUEST_END);
      clearSession();
      openingFired.current = false;
    };
  }, [sessionId]);

  // Fetch questId, then fire opening narration exactly once
  useEffect(() => {
    if (!sessionId) return;
    api.get(`/api/v1/quest/${sessionId}`).then(res => {
      const qId = res.data.data.questId as string;
      setQuestId(qId);
      if (openingFired.current) return;
      openingFired.current = true;
      startNarratorMessage();
      api.post('/api/v1/quest/input', {
        sessionId,
        characterId,
        questId: qId,
        input: 'Begin the quest. Set the scene and describe where my character is and what they see.',
      }).catch(() => finalizeNarratorMessage());
    }).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || streaming || !sessionId || !questId) return;
    const text = input.trim();
    setInput('');
    addPlayerMessage(text);
    startNarratorMessage();
    try {
      await api.post('/api/v1/quest/input', { sessionId, characterId, questId, input: text });
    } catch {
      finalizeNarratorMessage();
    }
  };

  const handleEnd = async () => {
    if (!sessionId) return;
    await api.post('/api/v1/quest/end', { sessionId }).catch(() => {});
    navigate(`/characters/${characterId}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-indigo-400 font-bold">Echoes of Aether</h1>
        <button onClick={handleEnd} className="text-sm text-gray-400 hover:text-white transition-colors">
          End Quest
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl w-full mx-auto">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'player' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'player'
                ? 'bg-indigo-700 text-white'
                : 'bg-gray-800 text-gray-100'
            }`}>
              {msg.content}
              {msg.streaming && <span className="inline-block w-1.5 h-4 bg-gray-400 ml-1 animate-pulse align-middle" />}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 px-4 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={streaming}
            placeholder={streaming ? 'The Dungeon Master is narrating...' : 'What do you do?'}
            className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2.5 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
