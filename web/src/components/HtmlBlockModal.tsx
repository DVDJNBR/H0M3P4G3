import React, { useState, useEffect } from 'react';

interface HtmlBlockModalProps {
  isOpen: boolean;
  title: string;
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export const HtmlBlockModal: React.FC<HtmlBlockModalProps> = ({
  isOpen,
  title: modalTitle,
  initialContent,
  onSave,
  onCancel,
}) => {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (isOpen) setContent(initialContent);
  }, [isOpen, initialContent]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(content);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl glass-panel rounded-2xl p-6 shadow-2xl border border-zinc-800 space-y-4">
        <h3 className="text-base font-bold text-zinc-100">{modalTitle}</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              HTML / CSS / JS
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              spellCheck={false}
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500 font-mono resize-y"
              autoFocus
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Rendu dans un iframe isolé. Le script s'exécute après le chargement complet de la
              page (pas de ralentissement au premier affichage).
            </p>
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
