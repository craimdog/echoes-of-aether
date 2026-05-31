import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useZones() {
    return useQuery({
        queryKey: ['zones'],
        queryFn: async () => {
            const res = await api.get('/api/v1/zones');
            return res.data.data.zones as any[];
        },
    });
}