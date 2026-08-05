import React from 'react';
import type { Column, Block } from '../types';
import { BlockView } from './BlockView';

interface ColumnViewProps {
  column: Column;
}

export const ColumnView: React.FC<ColumnViewProps> = ({ column }) => {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      {column.title && (
        <div className="flex items-center gap-2 px-1">
          <h2 className="text-sm font-bold tracking-tight text-zinc-300 uppercase">
            {column.title}
          </h2>
          <div className="h-px flex-1 bg-zinc-800/80" />
        </div>
      )}
      <div className="flex flex-col gap-4">
        {column.blocks.length === 0 ? (
          <div className="h-24 rounded-xl border border-dashed border-zinc-800/60 flex items-center justify-center text-xs text-zinc-600">
            Colonne vide
          </div>
        ) : (
          column.blocks.map((block: Block) => <BlockView key={block.id} block={block} />)
        )}
      </div>
    </div>
  );
};
