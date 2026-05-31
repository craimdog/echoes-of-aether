import { useEffect, useRef, useState } from 'react';
import { getSocket, connectSocket } from '../lib/socket';

interface ChatMessage {
    characterName: string;
    message: string;
    timestamp: number;
}

interface Props {
    zoneId: string;
    characterName: string;
    zoneName: string;
}

export default function ZoneChat({ zoneId, characterName, zoneName }: Props) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [presence, setPresence] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const socket = getSocket();
        connectSocket();

        socket.emit('zone:join', { zoneId, characterName });

        socket.on('zone:chat:message', (msg: ChatMessage) => {
            setMessages(prev => [...prev.slice(-99), msg]);
        });

        socket.on('zone:presence', (data: { zoneId: string, characters: string[] }) => {
            if (data.zoneId === zoneId) setPresence(data.characters);
        });

        return () => {
            socket.off('zone:chat:message');
            socket.off('zone:presence');
        };
    }, [zoneId, characterName]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = () => {
        if(!input.trim()) return;
        getSocket().emit('zone:chat', { zoneId, characterName, message: input.trim() });
        setInput('');
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col h-72">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
                <p className="text-sm font-semibold text-gray-300">{zoneName} - Zone Chat</p>
                {presence.length > 0 && (
                    <p className="text-xs text-gray-500">{presence.length} online</p>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 text-sm">
                {messages.length === 0 && (
                    <p className="text-gray-600 text-xs mt-2">No messages yet. Say hello!</p>
                )}
                {messages.map((msg, i) => (
                    <div key={i}>
                        <span className="text-indigo-400 font-semibold">{msg.characterName}: </span>
                        <span className="text-gray-300">{msg.message}</span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            <div className="flex gap-2 px-3 py-2 border-t border-gray-800">
                <input
                    type="text"
                    value={input}
                    maxLength={200}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder="Say something..."
                    className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-indigo-500"
                />
                <button onClick={send} className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                    Send
                </button>
            </div>
        </div>
    );
}