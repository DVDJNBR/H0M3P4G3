import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Column, Block } from '../types';
import { useLayout } from '../context/LayoutContext';
import { BlockView } from './BlockView';
import { AddBlockModal } from './AddBlockModal';

interface ColumnViewProps {
  column: Column;
}

export const ColumnView: React.FC<ColumnViewProps> = ({ column }) => {
  const { isEditorMode, deleteColumn, addBlock } = useLayout();
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);

  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const blockIds = column.blocks.map((b) => b.id);

  return (
    <>
      <div ref={setNodeRef} className="flex flex-col gap-4 min-w-0">
        {isEditorMode && (
          <div className="flex items-center justify-end gap-1 px-1">
            <button
              onClick={() => setShowAddBlockModal(true)}
              className="text-zinc-500 hover:text-indigo-400 p-1 transition-colors"
              title="Ajouter un bloc"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => deleteColumn(column.id)}
              className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
              title="Supprimer la colonne"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}

        <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-4 min-h-[60px]">
            {column.blocks.length === 0 ? (
              <div className="h-20 rounded-xl border border-dashed border-zinc-800/60 flex items-center justify-center text-xs text-zinc-600">
                {isEditorMode ? 'Déposer un bloc ici' : 'Colonne vide'}
              </div>
            ) : (
              column.blocks.map((block: Block) => <BlockView key={block.id} block={block} />)
            )}
          </div>
        </SortableContext>
      </div>

      <AddBlockModal
        isOpen={showAddBlockModal}
        onSave={(config) => {
          setShowAddBlockModal(false);
          addBlock(column.id, config);
        }}
        onCancel={() => setShowAddBlockModal(false)}
      />
    </>
  );
};
