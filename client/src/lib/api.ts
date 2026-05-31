import axios from 'axios';

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
});

let refreshing = false;
let queue: Array<() => void> = [];

const AUTH_ENDPOINTS = ['/api/v1/auth/refresh', '/api/v1/auth/me', '/api/v1/auth/login', '/api/v1/auth/register'];

api.interceptors.response.use(
    (res) => res,
    async (err) => {
        const original = err.config;
        const isAuthEndpoint = AUTH_ENDPOINTS.some((e) => original.url?.includes(e));

        if (err.response?.status === 401 && !original._retry && !isAuthEndpoint) {
            if (refreshing) {
                return new Promise((resolve, reject) => {
                    queue.push(() => api(original).then(resolve).catch(reject));
                });
            }
            original._retry = true;
            refreshing = true;
            try {
                await api.post('/api/v1/auth/refresh');
                queue.forEach((cb) => cb());
                queue = [];
                return api(original);
            } catch {
                queue = [];
            } finally {
                refreshing = false;
            }
        }
        return Promise.reject(err);
    }
);