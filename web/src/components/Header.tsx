import React from 'react';
import { useLayout } from '../context/LayoutContext';

export const Header: React.FC = () => {
  const { isEditorMode, toggleEditorMode, addColumn } = useLayout();

  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-zinc-800/80 px-6 py-3.5 mb-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xs">
            H3
          </div>
          <h1 className="text-lg font-bold tracking-[0.2em] text-zinc-100 uppercase">
            H0M3P4G3
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {isEditorMode && (
            <button
              onClick={() => addColumn()}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 text-xs font-medium transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Ajouter colonne</span>
            </button>
          )}

          <button
            onClick={toggleEditorMode}
            className={`flex items-center gap-2 py-1.5 px-3.5 rounded-lg border text-xs font-medium transition-all ${
              isEditorMode
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>{isEditorMode ? 'Mode Édition On' : 'Éditer'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
