import { create } from 'zustand';
import type { AuthUser } from '@aether/shared';
import { api } from '../lib/api';

interface AuthState {
    user: AuthUser | null;
    loading: boolean;
    setUser: (user: AuthUser | null) => void;
    logout: () => Promise<void>;
    fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,
    setUser: (user) => set({ user }),
    logout: async () => {
        await api.post('/api/v1/auth/logout');
        set({ user: null });
    },
    fetchMe: async () => {
        try {
            const res = await api.get('/api/v1/auth/me');
            set({ user: res.data.data.user, loading: false });
        } catch {
            set({ user: null, loading: false });
        }
    },
}));