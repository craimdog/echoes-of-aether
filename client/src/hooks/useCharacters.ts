import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useCharacters() {
    return useQuery({
        queryKey: ['characters'],
        queryFn: async () => {
            const res = await api.get('/api/v1/characters');
            return res.data.data.characters as any[];
        },
    });
}

export function useCreateCharacter() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: {name: string; class: string; zoneId: string }) => {
            const res = await api.post('/api/v1/characters', data);
            return res.data.data.character;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['characters'] }),
    });
}