import React, { useState } from 'react';

interface LinkModalProps {
  isOpen: boolean;
  title: string;
  initialUrl?: string;
  initialTitle?: string;
  initialFaviconOverride?: string;
  onSave: (url: string, title: string, faviconOverride?: string) => void;
  onCancel: () => void;
}

export const LinkModal: React.FC<LinkModalProps> = ({
  isOpen,
  title: modalTitle,
  initialUrl = '',
  initialTitle = '',
  initialFaviconOverride = '',
  onSave,
  onCancel,
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle);
  const [faviconOverride, setFaviconOverride] = useState(initialFaviconOverride);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setError('Veuillez saisir une URL.');
      return;
    }

    if (!/^https?:\/\//i.test(trimmedUrl)) {
      trimmedUrl = `https://${trimmedUrl}`;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setError('URL invalide (doit commencer par http:// ou https://).');
      return;
    }

    let trimmedOverride = faviconOverride.trim();
    if (trimmedOverride) {
      if (!/^https?:\/\//i.test(trimmedOverride)) {
        trimmedOverride = `https://${trimmedOverride}`;
      }
      try {
        new URL(trimmedOverride);
      } catch {
        setError('URL de favicon surcharge invalide (http:// ou https://).');
        return;
      }
    }

    setError(null);
    onSave(trimmedUrl, title.trim(), trimmedOverride || undefined);
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
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
              URL (ex: https://github.com)
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
              Titre (optionnel - auto-déduit si vide)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mon lien"
              className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
              Favicon Surchargé (URL optionnelle)
            </label>
            <input
              type="text"
              value={faviconOverride}
              onChange={(e) => setFaviconOverride(e.target.value)}
              placeholder="https://custom-icon.png"
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
