import React from 'react';
import type { Block, Link } from '../types';
import { LinkItem } from './LinkItem';

interface BlockViewProps {
  block: Block;
}

export const BlockView: React.FC<BlockViewProps> = ({ block }) => {
  return (
    <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col gap-3">
      {block.title && (
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800/80 pb-2">
          {block.title}
        </h3>
      )}

      {block.kind === 'links' && (
        <div className="flex flex-col gap-1.5">
          {block.links.length === 0 ? (
            <p className="text-xs text-zinc-600 italic py-2">Aucun lien</p>
          ) : (
            block.links.map((link: Link) => <LinkItem key={link.id} link={link} />)
          )}
        </div>
      )}

      {block.kind === 'raindrop' && (
        <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/30 text-xs text-indigo-300 flex items-center justify-between">
          <span>Collection Raindrop #{block.collectionId}</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-400 font-mono">
            Epic 3
          </span>
        </div>
      )}
    </div>
  );
};
