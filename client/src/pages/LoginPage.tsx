import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';

export default function LoginPage() {
    const navigate = useNavigate();
    const setUser = useAuthStore((s) => s.setUser);
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/api/v1/auth/login', form);
            setUser(res.data.data.user);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message ?? err.response?.data?.error ?? 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                <h1 className="text-3xl font-bold text-white text-center mb-2">Echoes of Aether</h1>
                <p className="text-gray-400 text-center mb-8">Sign in to continue your journey</p>

                <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl p-8 space-y-5 border border-gray-800">
                    {error && (
                        <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-3">{error}</p>
                    )}

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 transition-colors"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>

                    <p className="text-center text-gray-400 text-sm">
                        No account?{' '}
                        <Link to="/register" className="text-indigo-400 hover:text-indigo-300">
                            Create One
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}