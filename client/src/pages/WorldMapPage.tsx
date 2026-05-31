import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getSocket, connectSocket } from '../lib/socket';

const THREAT_COLORS: Record<number, string> = {
    1: 'border-green-700 bg-green-950',
    2: 'border-yellow-700 bg-yellow-950',
    3: 'border-orange-700 bg-orange-950',
    4: 'border-red-700 bg-red-950',
    5: 'border-red-900 bg-red-950',
};

const THREAT_LABEL: Record<number, string> = {
    1: 'Safe', 2: 'LOW', 3:'Moderate', 4: 'Dangerous', 5: 'Deadly',
};

export default function WorldMapPage() {
    const navigate = useNavigate();
    const [liveEvents, setLiveEvents] = useState<{ zoneName: string, description: string }[]>([]);

    const { data: zonesData } = useQuery({
        queryKey: ['zones'],
        queryFn: async () => {
            const res = await api.get('/api/v1/zones');
            return res.data.data.zones as any[];
        },
    });

    const { data: eventsData } = useQuery({
        queryKey: ['world-events'],
        queryFn: async () => {
            const res = await api.get('/api/v1/zones/world-events');
            return res.data.data.events as any[];
        },
    });

    useEffect(() => {
        const socket = getSocket();
        connectSocket();
        socket.join?.('world');
        socket.emit('world:join');

        socket.on('world:event', (payload: { zoneName: string; description: string }) => {
            setLiveEvents(prev => [payload, ...prev.slice(0, 19)]);
        });

        return () => { socket.off('world:event'); };
    }, []);

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <header className="border-b border-gray-800 px-6 py-3 items-center justify-between">
                <h1 className="text-xl font-bold text-indigo-400">Echoes of Aether - World Map</h1>
                <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-400 hover:text-white transition-colors">
                    ← Dashboard
                </button>
            </header>

            <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Zones grid */}
                <div className="lg:col-span-2">
                    <h2 className="text-lg font-bold mb-4">Zones</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {zonesData?.map((zone: any) => (
                            <div
                                key={zone.id}
                                className={`rounded-xl border p-4 ${THREAT_COLORS[zone.threatLevel] ?? 'border-gray-700 bg-gray-900'}`}
                            >
                                <div className="flex items-start justify-between mb-1">
                                    <h3 className="font-bold text-sm">{zone.name}</h3>
                                    <span className="text-xs text-gray-400">{THREAT_LABEL[zone.threatLevel]}</span>
                                </div>
                                <p className="text-xs text-gray-400 line-clamp-2 mb-2">{zone.lore}</p>
                                {zone.faction && (
                                    <p className="text-xs font-semibold" style={{ color: zone.faction.color }}>
                                        ⚑ {zone.faction.name}
                                    </p>
                                )}
                                <p className="text-xs text-gray-600 mt-1">{zone._count?.characters ?? 0} adventurers</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* World events feed */}
                <div>
                    <h2 className="text-lg font-bold mb-4">World Events</h2>
                    <div className="space-y-2">
                        {liveEvents.map((e, i) => (
                            <div key={`live-${i}`} className="bg-indigo-950 border border-indigo-800 rounded-lg px-3 py-2 text-xs">
                                <span className="text-indigo-400 font-semibold">{e.zoneName}: </span>
                                <span className="text-gray-300">{e.description}</span>
                            </div>
                        ))}
                        {eventsData?.map((e: any) => (
                            <div key={e.id} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs">
                                <span className="text-gray-400 font-semibold">{e.zone?.name}:</span>
                                <span className="text-gray-400">{e.description}</span>
                            </div>
                        ))}
                        {!liveEvents.length && !eventsData?.length && (
                            <p className="text-gray-600 text-sm">No world events yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}