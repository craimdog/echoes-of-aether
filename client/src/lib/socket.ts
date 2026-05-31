import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        socket = io(import.meta.env.VITE_WS_URL, {
            withCredentials: true,
            autoConnect: false,
        });
    }
    return socket;
}

export function connectSocket() {
    getSocket().connect();
}

export function disconnectSocket() {
    getSocket().disconnect();
}