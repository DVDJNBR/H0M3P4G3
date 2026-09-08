import React, { useState, useEffect } from 'react';

export interface LinkModalSavedDetails {
  url: string;
  title: string;
  faviconOverride?: string;
  secondaryUrl?: string;
  showStatusDot: boolean;
}

interface LinkModalProps {
  isOpen: boolean;
  title: string;
  initialUrl?: string;
  initialTitle?: string;
  initialFaviconOverride?: string;
  initialSecondaryUrl?: string;
  initialShowStatusDot?: boolean;
  onSave: (details: LinkModalSavedDetails) => void;
  onCancel: () => void;
}

function normalizeUrl(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export const LinkModal: React.FC<LinkModalProps> = ({
  isOpen,
  title: modalTitle,
  initialUrl = '',
  initialTitle = '',
  initialFaviconOverride = '',
  initialSecondaryUrl = '',
  initialShowStatusDot = false,
  onSave,
  onCancel,
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle);
  const [faviconOverride, setFaviconOverride] = useState(initialFaviconOverride);
  const [secondaryUrl, setSecondaryUrl] = useState(initialSecondaryUrl);
  const [showStatusDot, setShowStatusDot] = useState(initialShowStatusDot);
  const [error, setError] = useState<string | null>(null);

  // The modal instance stays mounted (isOpen just toggles visibility), so
  // without this the fields would carry stale values from the previous
  // open -- e.g. an "Ajouter" right after an "Éditer" would show the
  // edited link's old URL instead of a blank form.
  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl);
      setTitle(initialTitle);
      setFaviconOverride(initialFaviconOverride);
      setSecondaryUrl(initialSecondaryUrl);
      setShowStatusDot(initialShowStatusDot);
      setError(null);
    }
  }, [isOpen, initialUrl, initialTitle, initialFaviconOverride, initialSecondaryUrl, initialShowStatusDot]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setError('Veuillez saisir une URL.');
      return;
    }

    trimmedUrl = normalizeUrl(trimmedUrl);
    try {
      new URL(trimmedUrl);
    } catch {
      setError('URL invalide (doit commencer par http:// ou https://).');
      return;
    }

    let trimmedOverride = faviconOverride.trim();
    if (trimmedOverride) {
      trimmedOverride = normalizeUrl(trimmedOverride);
      try {
        new URL(trimmedOverride);
      } catch {
        setError('URL de favicon surchargé invalide (http:// ou https://).');
        return;
      }
    }

    let trimmedSecondaryUrl = secondaryUrl.trim();
    if (trimmedSecondaryUrl) {
      trimmedSecondaryUrl = normalizeUrl(trimmedSecondaryUrl);
      try {
        new URL(trimmedSecondaryUrl);
      } catch {
        setError('URL du lien secondaire invalide (http:// ou https://).');
        return;
      }
    }

    setError(null);
    onSave({
      url: trimmedUrl,
      title: title.trim(),
      faviconOverride: trimmedOverride || undefined,
      secondaryUrl: trimmedSecondaryUrl || undefined,
      showStatusDot,
    });
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
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
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
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
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

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Lien secondaire (ex: dépôt GitHub, optionnel)
            </label>
            <input
              type="text"
              value={secondaryUrl}
              onChange={(e) => setSecondaryUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
              className="w-full px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Affiché comme une seconde icône cliquable, à la suite de la première.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showStatusDot}
              onChange={(e) => setShowStatusDot(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-zinc-950"
            />
            <span className="text-xs font-medium text-zinc-400">
              Afficher un indicateur d'état à la place de l'icône (vert/orange/rouge)
            </span>
          </label>

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
