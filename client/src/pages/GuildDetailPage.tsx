import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCharacters } from '../hooks/useCharacters';
import { useAuthStore } from '../store/auth.store';
import { useState } from 'react';

const ROLE_COLORS: Record<string, string> = {
  MASTER: 'text-yellow-400', OFFICER: 'text-blue-400', MEMBER: 'text-gray-400',
};

export default function GuildDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { data: characters } = useCharacters();
  const [error, setError] = useState('');

  const { data: guildData, isLoading } = useQuery({
    queryKey: ['guild', id],
    queryFn: async () => (await api.get(`/api/v1/guilds/${id}`)).data.data.guild as any,
  });

  const myMemberships = characters?.filter((c: any) => c.guildMembership?.guildId === id) ?? [];
  const myMaster = myMemberships.find((c: any) => c.guildMembership?.role === 'MASTER');

  const leaveGuild = useMutation({
    mutationFn: async (characterId: string) =>
      api.post(`/api/v1/guilds/${id}/leave`, { characterId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', id] });
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
    onError: (err: any) => setError(err.response?.data?.message ?? err.response?.data?.error ?? 'Failed'),
  });

  const kickMember = useMutation({
    mutationFn: async (targetCharId: string) =>
      api.post(`/api/v1/guilds/${id}/kick`, { actorCharId: myMaster?.id, targetCharId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guild', id] }),
    onError: (err: any) => setError(err.response?.data?.message ?? err.response?.data?.error ?? 'Failed'),
  });

  const disband = useMutation({
    mutationFn: async () =>
      api.delete(`/api/v1/guilds/${id}`, { data: { characterId: myMaster?.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
      navigate('/guilds');
    },
    onError: (err: any) => setError(err.response?.data?.message ?? err.response?.data?.error ?? 'Failed'),
  });

  if (isLoading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  );

  const guild = guildData;

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate('/guilds')} className="text-gray-400 hover:text-white text-sm mb-6 block">← Guilds</button>

        {/* Header */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{ backgroundColor: guild.emblemColor + '33', border: `3px solid ${guild.emblemColor}` }}
            >
              {guild.name[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold">{guild.name}</h1>
              {guild.description && <p className="text-gray-400 text-sm">{guild.description}</p>}
            </div>
          </div>
          <div className="flex gap-4 text-sm text-gray-400">
            <span>Tier {guild.tier}</span>
            <span>{guild.xpPool} XP</span>
            <span>{guild.members.length} members</span>
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        </div>

        {/* Members */}
        <h2 className="font-bold mb-3">Members</h2>
        <div className="space-y-2 mb-6">
          {guild.members.map((m: any) => {
            const isMe = m.character?.userId === user?.id || characters?.some((c: any) => c.id === m.characterId);
            return (
              <div key={m.characterId} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <span className="font-medium">{m.character?.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{m.character?.zone?.name}</span>
                </div>
                <span className={`text-xs font-semibold ${ROLE_COLORS[m.role]}`}>{m.role}</span>
                {myMaster && m.role !== 'MASTER' && (
                  <button
                    onClick={() => kickMember.mutate(m.characterId)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Kick
                  </button>
                )}
                {isMe && m.role !== 'MASTER' && myMemberships.some((c: any) => c.id === m.characterId) && (
                  <button
                    onClick={() => leaveGuild.mutate(m.characterId)}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Leave
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Disband */}
        {myMaster && (
          <button
            onClick={() => {
              if (confirm('Disband this guild? This cannot be undone.')) disband.mutate();
            }}
            className="text-sm text-red-500 hover:text-red-400 transition-colors"
          >
            Disband Guild
          </button>
        )}
      </div>
    </div>
  );
}
