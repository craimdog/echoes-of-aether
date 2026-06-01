import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket, connectSocket } from '../lib/socket';
import { useQuestStore } from '../store/quest.store';
import { SOCKET_EVENTS } from '@aether/shared';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const CLASS_COLORS: Record<string, string> = {
  MAGE: 'text-blue-400', RANGER: 'text-green-400', PALADIN: 'text-yellow-400', ROGUE: 'text-purple-400',
};

export default function QuestPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const characterId = searchParams.get('characterId') ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { messages, streaming, setSession, addPlayerMessage, startNarratorMessage, appendChunk, finalizeNarratorMessage, clearSession } = useQuestStore();

  const [input, setInput] = useState('');
  const [questId, setQuestId] = useState('');
  const [questInfo, setQuestInfo] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const openingFired = useRef(false);
  const streamTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: character } = useQuery({
    queryKey: ['character', characterId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/characters/${characterId}`);
      return res.data.data.character as any;
    },
    enabled: !!characterId,
    refetchInterval: 30_000,
  });

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

    socket.on(SOCKET_EVENTS.QUEST_END, (payload: { sessionId: string; cleanText?: string | null }) => {
      if (payload.sessionId !== sessionId) return;
      if (streamTimeout.current) clearTimeout(streamTimeout.current);
      finalizeNarratorMessage(payload.cleanText);
      queryClient.invalidateQueries({ queryKey: ['character', characterId] });
    });

    const handleReconnect = () => socket.emit('quest:join', sessionId);
    socket.on('reconnect', handleReconnect);

    return () => {
      socket.off(SOCKET_EVENTS.QUEST_CHUNK);
      socket.off(SOCKET_EVENTS.QUEST_END);
      socket.off('reconnect', handleReconnect);
      clearSession();
      openingFired.current = false;
    };
  }, [sessionId]);

  // Fetch questId then fire opening narration or restore history
  useEffect(() => {
    if (!sessionId) return;
    api.get(`/api/v1/quest/${sessionId}`).then(async res => {
      const data = res.data.data;
      const qId = data.questId as string;
      setQuestId(qId);
      setQuestInfo(data.quest);

      const histRes = await api.get(`/api/v1/quest/${sessionId}/messages`);
      const history: { role: 'user' | 'assistant'; content: string }[] = histRes.data.data.messages;

      if (history.length > 0) {
        const restored = history.map(m => ({
          role: (m.role === 'user' ? 'player' : 'narrator') as 'player' | 'narrator',
          content: m.content,
        }));
        useQuestStore.setState({ messages: restored, streaming: false });
      } else {
        useQuestStore.setState({ messages: [], streaming: false });
        if (openingFired.current) return;
        openingFired.current = true;
        startNarratorMessage();
        api.post('/api/v1/quest/input', {
          sessionId, characterId, questId: qId,
          input: 'Begin the quest. Set the scene and describe where my character is and what they see.',
        }).catch(() => finalizeNarratorMessage());
      }
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
    streamTimeout.current = setTimeout(() => finalizeNarratorMessage(), 90_000);
    try {
      await api.post('/api/v1/quest/input', { sessionId, characterId, questId, input: text });
    } catch {
      if (streamTimeout.current) clearTimeout(streamTimeout.current);
      finalizeNarratorMessage();
    }
  };

  const handleEnd = async () => {
    if (!sessionId) return;
    await api.post('/api/v1/quest/end', { sessionId }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['character', characterId] });
    navigate(`/characters/${characterId}`);
  };

  const inventory: string[] = Array.isArray(character?.inventory) ? character.inventory : [];
  const xpForNext = character ? character.level * 150 : 150;
  const xpProgress = character ? Math.min(100, Math.round((character.xp / xpForNext) * 100)) : 0;

  const CLASS_BASE: Record<string, { hp: number; mp: number }> = {
    MAGE: { hp: 60, mp: 120 }, RANGER: { hp: 80, mp: 60 },
    PALADIN: { hp: 120, mp: 40 }, ROGUE: { hp: 70, mp: 50 },
  };
  const base = character ? (CLASS_BASE[character.class] ?? { hp: 60, mp: 50 }) : { hp: 60, mp: 50 };
  const lvl = character?.level ?? 1;
  const maxHp = base.hp + (lvl - 1) * Math.floor(base.hp * 0.1);
  const maxMp = base.mp + (lvl - 1) * Math.floor(base.mp * 0.1);

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-indigo-400 font-bold">Echoes of Aether</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {sidebarOpen ? 'Hide Stats' : 'Show Stats'}
          </button>
          <button
            onClick={() => navigate(`/characters/${characterId}`)}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Save & Exit
          </button>
          <button onClick={handleEnd} className="text-sm text-red-400 hover:text-red-300 transition-colors">
            End Quest
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — quest & zone info */}
        <div className="w-56 shrink-0 border-r border-gray-800 overflow-y-auto p-4 space-y-5 hidden lg:block">
          {questInfo ? (
            <>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Active Quest</p>
                <p className="font-bold text-sm text-indigo-300">{questInfo.title}</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{questInfo.briefing}</p>
              </div>
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Rewards</p>
                <p className="text-xs text-indigo-400">{questInfo.rewardXp} XP</p>
                <p className="text-xs text-yellow-400">{questInfo.rewardGold} Gold</p>
              </div>
              {questInfo.zone && (
                <div className="border-t border-gray-800 pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Zone</p>
                  <p className="text-xs text-gray-300 font-medium">{questInfo.zone.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Threat {questInfo.zone.threatLevel}/5</p>
                  {questInfo.zone.faction && (
                    <p className="text-xs mt-0.5" style={{ color: questInfo.zone.faction.color }}>
                      ⚑ {questInfo.zone.faction.name}
                    </p>
                  )}
                </div>
              )}
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Quick Actions</p>
                {['I search the area', 'I talk to someone nearby', 'I check my surroundings', 'I rest and recover'].map(action => (
                  <button
                    key={action}
                    onClick={() => setInput(action)}
                    className="block w-full text-left text-xs text-gray-400 hover:text-white py-1 hover:bg-gray-800 rounded px-2 transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-600">Loading quest...</p>
          )}
        </div>

        {/* Messages */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={msg.role === 'player' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'player' ? 'bg-indigo-700 text-white' : 'bg-gray-800 text-gray-100'
                }`}>
                  {msg.role === 'narrator' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({children}) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                        h2: ({children}) => <h2 className="text-base font-bold mb-1">{children}</h2>,
                        strong: ({children}) => <strong className="font-bold text-white">{children}</strong>,
                        em: ({children}) => <em className="italic text-gray-300">{children}</em>,
                        hr: () => <hr className="border-gray-600 my-2" />,
                        p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : msg.content}
                  {msg.streaming && <span className="inline-block w-1.5 h-4 bg-gray-400 ml-1 animate-pulse align-middle" />}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-800 px-4 py-3 shrink-0">
            <div className="flex gap-3">
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

        {/* Sidebar */}
        {sidebarOpen && character && (
          <div className="w-64 shrink-0 border-l border-gray-800 overflow-y-auto p-4 space-y-4 hidden lg:block">
            {/* Character */}
            <div>
              <p className="font-bold text-sm">{character.name}</p>
              <p className={`text-xs ${CLASS_COLORS[character.class]}`}>{character.class} · Level {character.level}</p>
            </div>

            {/* Stats */}
            <div className="space-y-2">
              <StatBar label="HP" value={character.hp} max={maxHp} color="bg-green-500" />
              <StatBar label="MP" value={character.mp} max={maxMp} color="bg-blue-500" />
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>XP</span>
                  <span>{character.xp} / {xpForNext}</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${xpProgress}%` }} />
                </div>
              </div>
            </div>

            {/* Gold */}
            <div className="bg-gray-900 rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">Gold</span>
              <span className="text-yellow-400 font-bold text-sm">{character.gold}</span>
            </div>

            {/* Zone */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Current Zone</p>
              <p className="text-xs text-gray-300">{character.zone?.name}</p>
            </div>

            {/* Inventory */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Inventory</p>
              {inventory.length === 0 ? (
                <p className="text-xs text-gray-600 italic">Empty</p>
              ) : (
                <ul className="space-y-1">
                  {inventory.map((item: string, i: number) => (
                    <li key={i} className="text-xs text-gray-300 bg-gray-900 rounded px-2 py-1">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span>{value} / {max}</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
