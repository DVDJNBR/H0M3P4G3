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
  const { isEditorMode, renameColumn, deleteColumn, addBlock } = useLayout();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(column.title);
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);

  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const handleTitleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingTitle(false);
    if (titleInput.trim() !== column.title) {
      renameColumn(column.id, titleInput.trim());
    }
  };

  const blockIds = column.blocks.map((b) => b.id);

  return (
    <>
      <div ref={setNodeRef} className="flex flex-col gap-4 min-w-0">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isEditorMode && isEditingTitle ? (
              <form onSubmit={handleTitleSubmit} className="flex-1">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleSubmit}
                  autoFocus
                  className="w-full bg-zinc-900 border border-indigo-500/50 rounded px-2 py-0.5 text-xs text-zinc-100 uppercase tracking-wider font-bold focus:outline-none"
                />
              </form>
            ) : (
              <h2
                onClick={() => isEditorMode && setIsEditingTitle(true)}
                className={`text-sm font-bold tracking-tight text-zinc-300 uppercase truncate ${
                  isEditorMode ? 'cursor-pointer hover:text-zinc-100 hover:underline' : ''
                }`}
              >
                {column.title || 'Colonne'}
              </h2>
            )}
            <div className="h-px flex-1 bg-zinc-800/80" />
          </div>

          {isEditorMode && (
            <div className="flex items-center gap-1">
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
        </div>

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
