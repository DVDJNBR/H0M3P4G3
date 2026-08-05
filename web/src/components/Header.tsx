import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-zinc-800/80 px-6 py-3.5 mb-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xs">
            H3
          </div>
          <h1 className="text-lg font-bold tracking-[0.2em] text-zinc-100 uppercase">
            H0M3P4G3
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-zinc-400 font-medium">En ligne</span>
        </div>
      </div>
    </header>
  );
};
