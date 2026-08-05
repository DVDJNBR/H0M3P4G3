import React from 'react';
import type { Column } from '../types';
import { useLayout } from '../context/LayoutContext';
import { ColumnView } from './ColumnView';
import { Header } from './Header';

export const LayoutView: React.FC = () => {
  const { layout, isLoading, error, loadLayout } = useLayout();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Chargement du layout...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="glass-panel rounded-2xl p-6 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-zinc-100">Erreur de chargement</h2>
          <p className="text-xs text-zinc-400">{error}</p>
          <button
            onClick={() => loadLayout()}
            className="py-2 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-all"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!layout || layout.columns.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-center text-zinc-500 text-sm">
          Aucune colonne configurée.
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-16">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Responsive layout reflow: 1 col on mobile, 2 on tablet, 3 on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {layout.columns.map((column: Column) => (
            <ColumnView key={column.id} column={column} />
          ))}
        </div>
      </main>
    </div>
  );
};
