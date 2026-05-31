import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import ZoneChat from '../components/ZoneChat';

export default function CharacterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: charData, isLoading } = useQuery({
    queryKey: ['character', id],
    queryFn: async () => {
      const res = await api.get(`/api/v1/characters/${id}`);
      return res.data.data.character as any;
    },
  });

  const { data: questData } = useQuery({
    queryKey: ['zone-quests', charData?.zoneId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/zones/${charData.zoneId}/quests`);
      return res.data.data.quests as any[];
    },
    enabled: !!charData?.zoneId,
  });

  const startQuest = useMutation({
    mutationFn: async (questId: string) => {
      const res = await api.post('/api/v1/quest/start', { characterId: id, questId });
      return res.data.data.sessionId as string;
    },
    onSuccess: (sessionId) => {
      navigate(`/quest/${sessionId}?characterId=${id}`);
    },
  });

  if (isLoading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  );

  const char = charData;
  const CLASS_COLORS: Record<string, string> = {
    MAGE: 'text-blue-400', RANGER: 'text-green-400', PALADIN: 'text-yellow-400', ROGUE: 'text-purple-400',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white text-sm mb-6">
          ← Dashboard
        </button>

        {/* Character header */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{char.name}</h1>
              <p className={`font-semibold ${CLASS_COLORS[char.class]}`}>{char.class}</p>
              <p className="text-gray-400 text-sm mt-1">{char.zone?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Level {char.level}</p>
              <p className="text-sm text-gray-400">{char.xp} XP</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-800 rounded-lg py-2">
              <p className="text-xs text-gray-400">HP</p>
              <p className="font-bold text-green-400">{char.hp}</p>
            </div>
            <div className="bg-gray-800 rounded-lg py-2">
              <p className="text-xs text-gray-400">MP</p>
              <p className="font-bold text-blue-400">{char.mp}</p>
            </div>
            <div className="bg-gray-800 rounded-lg py-2">
              <p className="text-xs text-gray-400">Gold</p>
              <p className="font-bold text-yellow-400">{char.gold}</p>
            </div>
          </div>
        </div>

        {/* Available quests */}
        <h2 className="text-lg font-bold mb-4">Available Quests in {char.zone?.name}</h2>
        {!questData || questData.length === 0 ? (
          <p className="text-gray-500">No quests available in this zone.</p>
        ) : (
          <div className="space-y-3">
            {questData.map((quest: any) => (
              <div key={quest.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold mb-1">{quest.title}</h3>
                    <p className="text-gray-400 text-sm">{quest.briefing}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Reward: <span className="text-indigo-400">{quest.rewardXp} XP</span> · <span className="text-yellow-400">{quest.rewardGold} Gold</span>
                    </p>
                  </div>
                  <button
                    onClick={() => startQuest.mutate(quest.id)}
                    disabled={startQuest.isPending}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
                  >
                    {startQuest.isPending ? '...' : 'Begin'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Zone Chat */}
        <div className="mt-8">
          <ZoneChat
            zoneId={char.zoneId}
            characterName={char.name}
            zoneName={char.zone?.name ?? ''}
          />
        </div>
      </div>
    </div>
  );
}
