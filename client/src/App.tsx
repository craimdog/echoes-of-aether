import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth.store';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CreateCharacterPage from './pages/CreateCharacterPage';
import CharacterPage from './pages/CharacterPage';
import QuestPage from './pages/QuestPage';
import WorldMapPage from './pages/WorldMapPage';
import AdminPage from './pages/AdminPage';
import GuildsPage from './pages/GuildsPage';
import GuildDetailPage from './pages/GuildDetailPage';

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading, fetchMe } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/dashboard" />} />
      <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/login" />} />
      <Route path="/characters/new" element={user ? <CreateCharacterPage /> : <Navigate to="/login" />} />
      <Route path="/characters/:id" element={user ? <CharacterPage /> : <Navigate to="/login" />} />
      <Route path="/quest/:sessionId" element={user ? <QuestPage /> : <Navigate to="/login" />} />
      <Route path="/world" element={user ? <WorldMapPage /> : <Navigate to="/login" />} />
      <Route path="/admin" element={user ? <AdminPage /> : <Navigate to="/login" />} />
      <Route path="/guilds" element={user ? <GuildsPage /> : <Navigate to="/login" />} />
      <Route path="/guilds/:id" element={user ? <GuildDetailPage /> : <Navigate to="/login" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
