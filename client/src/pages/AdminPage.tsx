import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

type Tab = 'overview' | 'zones' | 'factions' | 'events' | 'characters';

export default function AdminPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<Tab>('overview');
    const [eventForm, setEventForm] = useState({ zoneId: '', description: '' });

    const { data: stats } = useQuery({
        queryKey: ['admin-stats'],
        queryFn: async () => (await api.get('/api/v1/admin/stats')).data.data,
        refetchInterval: 10000,
    });

    const { data: zonesData } = useQuery({
        queryKey: ['admin-zones'],
        queryFn: async () => (await api.get('/api/v1/admin/zones')).data.data.zones,
        enabled: tab === 'zones',
    });

    const { data: factionsData } = useQuery({
        queryKey: ['admin-factions'],
        queryFn: async () => (await api.get('/api/v1/admin/factions')).data.data.factions,
        enabled: tab === 'factions',
    });

    const { data: eventsData } = useQuery({
        queryKey: ['admin-events'],
        queryFn: async () => (await api.get('/api/v1/admin/events')).data.data.events,
        enabled: tab === 'events'
    });

    const { data: charsData } = useQuery({
        queryKey: ['admin-characters'],
        queryFn: async () => (await api.get('/api/v1/admin/characters')).data.data.characters,
        enabled: tab === 'characters',
    });

    const triggerEvent = useMutation({
        mutationFn: async () => api.post('/api/v1/admin/events', eventForm),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-events'] });
            setEventForm({ zoneId: '', description: '' });
        },
    });

    const resetZone = useMutation({
        mutationFn: async (zoneId: string) => api.post(`/api/v1/admin/zones/${zoneId}/reset`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-zones'] }),
    });

    const TABS: { key: Tab, label: string }[] = [
        { key: 'overview', label: 'Overview' },
        { key: 'zones', label: 'Zones' },
        { key: 'factions', label: 'Factions' },
        { key: 'events', label: 'Events' },
        { key: 'characters', label: 'Characters' },
    ];

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
                <h1 className="text-xl font-bold text-red-400">Admin Panel</h1>
                <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-400 hover:text-white transition-colors">
                    ← Dashboard
                </button>
            </header>

            <div className="flex border-b border-gray-800 px-6">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            tab === t.key ? 'border-red-500 text-white' : 'border-transparent text-gray-400 hover:text-white'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="max-w-6xl mx-auto px-6 py-7">

                {/* Overview */}
                {tab === 'overview' && stats && (
                    <div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                            {[
                                { label: 'Users', value: stats.users },
                                { label: 'Characters', value: stats.characters },
                                { label: 'Zones', value: stats.zones },
                                { label: 'Active Sessions', value: stats.activeSessions },
                                { label: 'World Events', value: stats.worldEvents },
                                { label: 'Connected', value: stats.connectedSockets },
                            ].map(s => (
                                <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-red-400">{s.value}</p>
                                    <p className="text-xs text-gray-400 mt-1">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Zones */}
                {tab === 'zones' && (
                    <div className="space-y-3">
                        {zonesData?.map((zone: any) => (
                            <div key={zone.id} className="bg-gray-900 border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
                                <div>
                                    <p className="font-bold">{zone.name}</p>
                                    <p className="text-xs text-gray-400">
                                        Threat: {zone.threatLevel} · Faction: {zone.faction?.name ?? 'None'} · {zone._count.characters} chars · {zone._count.loreFragments} lore
                                    </p>
                                </div>
                                <button
                                    onClick={() => resetZone.mutate(zone.id)}
                                    className="shrink-0 text-xs bg-red-900 hover:bg-red-800 text-red-200 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    Reset Zone
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Factions */}
                {tab === 'factions' && (
                    <div className="space-y-3">
                        {factionsData?.map((f: any) => (
                            <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: f.color }} />
                                    <p className="font-bold">{f.name}</p>
                                    <p className="text-sm text-gray-400 ml-auto">Power: {f.globalPower}</p>
                                </div>
                                <p className="text-xs text-gray-400">{f.description}</p>
                                <p className="text-xs text-gray-500 mt-1">{f._count.characters} member · {f._count.zones} zones controlled</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Events */}
                {tab === 'events' && (
                    <div>
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
                            <p className="text-sm font-semibold mb-3">Trigger World Event</p>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    placeholder="Zone ID"
                                    value={eventForm.zoneId}
                                    onChange={e => setEventForm(f => ({ ...f, zoneId: e.target.value }))}
                                    className="w-48 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-red-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Event description..."
                                    value={eventForm.description}
                                    onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                                    className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-red-500"
                                />
                                <button
                                    onClick={() => triggerEvent.mutate()}
                                    disabled={!eventForm.zoneId || !eventForm.description}
                                    className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                                >
                                    Fire
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {eventsData?.map((e: any) => (
                                <div key={e.id} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm flex items-center gap-3">
                                    <span className="text-gray-500 text-xs shrink-0">{new Date(e.createdAt).toLocaleString()}</span>
                                    <span className="text-indigo-400 shrink-0">{e.zone?.name}</span>
                                    <span className="text-gray-300">{e.description}</span>
                                    {e.triggeredBy && <span className="text-gray-500 text-xs ml-auto">by {e.triggeredBy.name}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Characters */}
                {tab === 'characters' && (
                    <div className="space-y-2">
                        {charsData?.map((c: any) => (
                            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-4">
                                <div className="flex-1">
                                    <p className="font-semibold">{c.name} <span className="text-xs text-gray-500">({c.class})</span></p>
                                    <p className="text-xs text-gray-400">{c.user?.username} · {c.zone?.name} · Lv{c.level} · {c.hp}HP</p>
                                </div>
                                {!c.isAlive && <span className="text-xs text-red-500 font-semibold">DEAD</span>}
                                {c.faction && <span className="text-xs text-gray-400">{c.faction.name}</span>}
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
}