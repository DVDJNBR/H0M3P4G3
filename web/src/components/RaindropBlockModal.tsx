import React, { useState, useEffect } from 'react';

interface RaindropBlockModalProps {
  isOpen: boolean;
  title: string;
  initialCollectionId?: string;
  initialDisplayCap?: number;
  onSave: (collectionId: string, displayCap?: number) => void;
  onCancel: () => void;
}

export const RaindropBlockModal: React.FC<RaindropBlockModalProps> = ({
  isOpen,
  title: modalTitle,
  initialCollectionId = '',
  initialDisplayCap,
  onSave,
  onCancel,
}) => {
  const [collectionId, setCollectionId] = useState(initialCollectionId);
  const [displayCap, setDisplayCap] = useState<string>(
    initialDisplayCap ? String(initialDisplayCap) : '',
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCollectionId(initialCollectionId);
      setDisplayCap(initialDisplayCap ? String(initialDisplayCap) : '');
      setError(null);
    }
  }, [isOpen, initialCollectionId, initialDisplayCap]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    onSave(trimmedCollectionId, parsedCap);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md glass-panel rounded-2xl p-6 shadow-2xl border border-zinc-800 space-y-4">
        <h3 className="text-base font-bold text-zinc-100">{modalTitle}</h3>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              ID de collection Raindrop
            </label>
            <input
              type="text"
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              placeholder="ex: 12345678"
              className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500 font-mono"
              autoFocus
              required
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              L'ID numérique de la collection Raindrop.io (ex: 0 pour Tous, -1 pour Non classé).
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
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
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
