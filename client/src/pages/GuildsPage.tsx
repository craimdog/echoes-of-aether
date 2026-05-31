import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCharacters } from '../hooks/useCharacters';

const PRESET_COLORS = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

export default function GuildsPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: characters } = useCharacters();

    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ characterId: '', name: '', emblemColor: '#6366f1', description: '' });
    const [joinCharId, setJoinCharId] = useState('');
    const [error, setError] = useState('');

    const { data: guildsData, isLoading } = useQuery({
        queryKey: ['guilds'],
        queryFn: async () => (await api.get('/api/v1/guilds')).data.data.guilds as any[],
    });

    const createGuild = useMutation({
        mutationFn: async () => api.post('/api/v1/guilds', form),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['guilds'] });
            setShowCreate(false);
            setError('');
        },
        onError: (err: any) => setError(err.response?.data?.message ?? err.response?.data?.error ?? 'Failed to create guild'),
    });

    const joinGuild = useMutation({
        mutationFn: async (guildId: string) =>
            api.post(`/api/v1/guilds/${guildId}/join`, { characterId: joinCharId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['guilds'] });
            queryClient.invalidateQueries({ queryKey: ['characters'] });
        },
        onError: (err: any) => setError(err.response?.data?.message ?? err.response?.data?.error ?? 'Failed to join guild'),
    });

    const eligibleChars = characters?.filter((c: any) => !c.guildMembership && c.isAlive) ?? [];

    return (
        <div className="min-h-screen bg-gray-950 text-white px-4 py-10">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white text-sm mb-2 block">← Dashboard</button>
                        <h1 className="text-2xl font-bold">Guilds</h1>
                    </div>
                    <button
                        onClick={() => setShowCreate(s => !s)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-4 py-2.5 transition-colors"
                    >
                        {showCreate ? 'Cancel' : '+ Found Guild'}
                    </button>
                </div>

                {/* Create form */}
                {showCreate && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 space-y-4">
                        <h2 className="font-bold">Found a New Guild</h2>
                        <p className="text-xs text-gray-400">Requires a level 5+ character and 500 gold.</p>
                        {error && <p className="text-red-400 text-sm">{error}</p>}

                        <select
                            value={form.characterId}
                            onChange={e => setForm(f => ({ ...f, characterId: e.target.value }))}
                            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
                        >
                            <option value="">Select character...</option>
                            {characters?.filter((c: any) => !c.guildMembership && c.isAlive).map((c: any) => (
                                <option key={c.id} value={c.id}>{c.name} (Lv{c.level}, {c.gold}g)</option>
                            ))}
                        </select>

                        <input
                            type="text"
                            placeholder="Guild name"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
                        />

                        <input
                            type="text"
                            placeholder="Description (optional)"
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description:e.target.value }))}
                            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
                        />

                        <div>
                            <p className="text-sm text-gray-400 mb-2">Emblem color</p>
                            <div className="flex gap-2">
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, emblemColor: c }))}
                                        className={`w-7 h-7 rounded-full border-2 transition-all ${form.emblemColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => createGuild.mutate()}
                            disabled={!form.characterId || !form.name || createGuild.isPending}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition-colors"
                        >
                            {createGuild.isPending ? 'Creating...' : 'Found Guild'}
                        </button>
                    </div>
                )}

                {/* Join character selector */}
                {eligibleChars.length > 0 && (
                    <div className="mb-4 flex items-center gap-3">
                        <p className="text-xs text-gray-400">Join as:</p>
                        <select
                            value={joinCharId}
                            onChange={e => setJoinCharId(e.target.value)}
                            className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none"
                        >
                            <option value="">Select character...</option>
                            {eligibleChars.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Guild list */}
                {isLoading ? (
                    <p className="text-gray-500">Loading guilds...</p>
                ) : guildsData?.length === 0 ? (
                    <p className="text-gray-500">No guilds yet. Be the first to found one!</p>
                ) : (
                    <div className="space-y-3">
                        {guildsData?.map((guild: any) => (
                            <div
                                key={guild.id}
                                className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4 hover:border-gray-600 transition-colors"
                            >
                                <div
                                    className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-lg font-bold"
                                    style={{ backgroundColor: guild.emblemColor + '33', border: `2px solid ${guild.emblemColor}` }}
                                >
                                    {guild.name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold">{guild.name}</p>
                                    {guild.description && <p className="text-xs text-gray-400 truncate">{guild.description}</p>}
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {guild._count.members} members · Tier {guild.tier} · {guild.xpPool} XP
                                    </p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => navigate(`/guilds/${guild.id}`)}
                                        className="text-xs text-gray-400 hover:text-white px-3 py-1.5 border border-gray-700 rounded-lg transition-colors"
                                    >
                                        View
                                    </button>
                                    {joinCharId && (
                                        <button
                                            onClick={() => joinGuild.mutate(guild.id)}
                                            disabled={joinGuild.isPending}
                                            className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            Join
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}