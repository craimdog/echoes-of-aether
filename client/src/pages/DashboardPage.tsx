import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useCharacters } from '../hooks/useCharacters';
import { CHARACTER_LIMITS } from '@aether/shared';

const CLASS_COLORS: Record<string, string> = {
  MAGE:    'bg-blue-900 text-blue-200',
  RANGER:  'bg-green-900 text-green-200',
  PALADIN: 'bg-yellow-900 text-yellow-200',
  ROGUE:   'bg-purple-900 text-purple-200',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { data: characters, isLoading } = useCharacters();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-indigo-400">Echoes of Aether</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user?.username}</span>
          <button onClick={() => navigate('/world')} className="text-sm text-gray-400 hover:text-white transition-colors">
            World Map
          </button>
          <button onClick={() => navigate('/guilds')} className="text-sm text-gray-400 hover:text-white transition-colors">
            Guilds
          </button>
          {user?.role === 'ADMIN' && (
            <button onClick={() => navigate('/admin')} className="text-sm text-red-400 hover:text-red-300 transition-colors">
              Admin
            </button>
          )}
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Your Characters</h2>
            <p className="text-gray-400 text-sm mt-1">
              {characters?.length ?? 0} / {CHARACTER_LIMITS.maxPerAccount} slots used
            </p>
          </div>
          {(characters?.length ?? 0) < CHARACTER_LIMITS.maxPerAccount && (
            <button
              onClick={() => navigate('/characters/new')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-5 py-2.5 transition-colors"
            >
              + New Character
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="text-gray-500">Loading characters...</p>
        ) : characters?.length === 0 ? (
          <div className="border border-dashed border-gray-700 rounded-xl p-16 text-center">
            <p className="text-gray-400 text-lg mb-2">No characters yet</p>
            <p className="text-gray-600 text-sm mb-6">Create your first character to begin your journey</p>
            <button
              onClick={() => navigate('/characters/new')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-6 py-3 transition-colors"
            >
              Create Character
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {characters?.map((char) => (
              <div key={char.id} onClick={() => navigate(`/characters/${char.id}`)} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-600 transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{char.name}</h3>
                    <p className="text-gray-400 text-sm">{char.zone?.name}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${CLASS_COLORS[char.class] ?? 'bg-gray-800 text-gray-300'}`}>
                    {char.class}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-800 rounded-lg py-2">
                    <p className="text-xs text-gray-400">Level</p>
                    <p className="font-bold">{char.level}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg py-2">
                    <p className="text-xs text-gray-400">HP</p>
                    <p className="font-bold text-green-400">{char.hp}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg py-2">
                    <p className="text-xs text-gray-400">Gold</p>
                    <p className="font-bold text-yellow-400">{char.gold}</p>
                  </div>
                </div>
                {!char.isAlive && (
                  <p className="text-red-500 text-xs font-semibold mt-3 text-center">DECEASED</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
