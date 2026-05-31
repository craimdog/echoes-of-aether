import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateCharacter } from '../hooks/useCharacters';
import { useZones } from '../hooks/useZones';

const CLASSES = [
  { value: 'MAGE',    label: 'Mage',    desc: 'Master of arcane arts. High MP, low HP.' },
  { value: 'RANGER',  label: 'Ranger',  desc: 'Swift hunter of the wilds. Balanced stats.' },
  { value: 'PALADIN', label: 'Paladin', desc: 'Holy warrior. Highest HP, low MP.' },
  { value: 'ROGUE',   label: 'Rogue',   desc: 'Shadow operative. Lethal but fragile.' },
] as const;

const THREAT_COLORS: Record<number, string> = {
  1: 'text-green-400',
  2: 'text-yellow-400',
  3: 'text-orange-400',
  4: 'text-red-400',
  5: 'text-red-600',
};

export default function CreateCharacterPage() {
  const navigate = useNavigate();
  const { data: zones, isLoading: zonesLoading } = useZones();
  const createCharacter = useCreateCharacter();

  const [name, setName] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !selectedZone) {
      setError('Please select a class and starting zone.');
      return;
    }
    setError('');
    try {
      await createCharacter.mutateAsync({ name, class: selectedClass, zoneId: selectedZone });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.response?.data?.error ?? 'Failed to create character');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-2xl font-bold mb-1">Create Character</h1>
        <p className="text-gray-400 mb-8">Choose wisely — your story begins here.</p>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-3">{error}</p>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Character Name</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a name..."
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Class */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Class</label>
            <div className="grid grid-cols-2 gap-3">
              {CLASSES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setSelectedClass(c.value)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    selectedClass === c.value
                      ? 'border-indigo-500 bg-indigo-950'
                      : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                  }`}
                >
                  <p className="font-semibold">{c.label}</p>
                  <p className="text-xs text-gray-400 mt-1">{c.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Starting Zone */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Starting Zone</label>
            {zonesLoading ? (
              <p className="text-gray-500 text-sm">Loading zones...</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                {zones?.map((zone) => (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => setSelectedZone(zone.id)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedZone === zone.id
                        ? 'border-indigo-500 bg-indigo-950'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{zone.name}</span>
                      <span className={`text-xs font-semibold ${THREAT_COLORS[zone.threatLevel] ?? 'text-gray-400'}`}>
                        Threat {zone.threatLevel}
                      </span>
                    </div>
                    {zone.faction && (
                      <p className="text-xs text-gray-500 mt-0.5">Controlled by {zone.faction.name}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={createCharacter.isPending}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-3 transition-colors"
          >
            {createCharacter.isPending ? 'Creating...' : 'Begin Your Journey'}
          </button>
        </form>
      </div>
    </div>
  );
}
