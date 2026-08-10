import React, { useState } from 'react';

interface AddBlockModalProps {
  isOpen: boolean;
  onSave: (config: {
    kind: 'links' | 'raindrop';
    title: string;
    collectionId?: string;
    displayCap?: number;
  }) => void;
  onCancel: () => void;
}

export const AddBlockModal: React.FC<AddBlockModalProps> = ({
  isOpen,
  onSave,
  onCancel,
}) => {
  const [kind, setKind] = useState<'links' | 'raindrop'>('links');
  const [title, setTitle] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [displayCap, setDisplayCap] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (kind === 'raindrop') {
      const trimmedCollectionId = collectionId.trim();
      if (!trimmedCollectionId) {
        setError('Veuillez saisir un ID de collection Raindrop.');
        return;
      }

      let parsedCap: number | undefined = undefined;
      if (displayCap.trim() !== '') {
        const num = parseInt(displayCap.trim(), 10);
        if (isNaN(num) || num <= 0) {
          setError("Le nombre max d'éléments doit être un nombre entier positif.");
          return;
        }
        parsedCap = num;
      }

      setError(null);
      onSave({
        kind: 'raindrop',
        title: title.trim() || 'Raindrop',
        collectionId: trimmedCollectionId,
        displayCap: parsedCap,
      });
    } else {
      setError(null);
      onSave({
        kind: 'links',
        title: title.trim() || 'Nouveau bloc',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md glass-panel rounded-2xl p-6 shadow-2xl border border-zinc-800 space-y-4">
        <h3 className="text-base font-bold text-zinc-100">Ajouter un bloc</h3>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
              Type de bloc
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setKind('links');
                  setError(null);
                }}
                className={`p-3 rounded-xl border text-xs font-medium text-left flex flex-col gap-1 transition-all ${
                  kind === 'links'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <span className="font-bold">Bloc de Liens</span>
                <span className="text-[11px] opacity-70">Raccourcis web personnalisables</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setKind('raindrop');
                  setError(null);
                }}
                className={`p-3 rounded-xl border text-xs font-medium text-left flex flex-col gap-1 transition-all ${
                  kind === 'raindrop'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <span className="font-bold">Bloc Raindrop</span>
                <span className="text-[11px] opacity-70">Collection de favoris Raindrop.io</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
              Titre du bloc
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === 'links' ? 'ex: Dev Tools, Médias' : 'ex: Articles, Films'}
              className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500"
              autoFocus
            />
          </div>

          {kind === 'raindrop' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                  ID de collection Raindrop
                </label>
                <input
                  type="text"
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  placeholder="ex: 12345678"
                  className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                  Nombre max d'éléments à afficher (optionnel)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={displayCap}
                  onChange={(e) => setDisplayCap(e.target.value)}
                  placeholder="ex: 5 (vide = tous)"
                  className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="py-2 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-lg shadow-indigo-600/20 transition-all"
            >
              Ajouter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
