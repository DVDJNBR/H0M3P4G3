import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block, Link } from '../types';
import { useLayout } from '../context/LayoutContext';
import { LinkItem } from './LinkItem';
import { ConfirmModal } from './ConfirmModal';

interface BlockViewProps {
  block: Block;
}

export const BlockView: React.FC<BlockViewProps> = ({ block }) => {
  const { isEditorMode, renameBlock, deleteBlock } = useLayout();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(block.title);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: !isEditorMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleTitleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingTitle(false);
    if (titleInput.trim() !== block.title) {
      renameBlock(block.id, titleInput.trim());
    }
  };

  const handleDeleteRequest = () => {
    // Acceptance Criteria: Prompt confirmation if block has links, otherwise delete immediately.
    if (block.kind === 'links' && block.links.length > 0) {
      setShowConfirmDelete(true);
    } else {
      deleteBlock(block.id);
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`glass-panel glass-panel-hover rounded-xl p-4 flex flex-col gap-3 group relative ${
          isDragging ? 'ring-2 ring-indigo-500/50 z-30' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isEditorMode && (
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 p-0.5"
                title="Glisser pour déplacer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
              </div>
            )}

            {isEditorMode && isEditingTitle ? (
              <form onSubmit={handleTitleSubmit} className="flex-1">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleSubmit}
                  autoFocus
                  className="w-full bg-zinc-900 border border-indigo-500/50 rounded px-2 py-0.5 text-xs text-zinc-100 uppercase tracking-wider font-semibold focus:outline-none"
                />
              </form>
            ) : (
              <h3
                onClick={() => isEditorMode && setIsEditingTitle(true)}
                className={`text-xs font-semibold uppercase tracking-wider text-zinc-400 truncate ${
                  isEditorMode ? 'cursor-pointer hover:text-zinc-200 hover:underline' : ''
                }`}
              >
                {block.title || 'Sans titre'}
              </h3>
            )}
          </div>

          {isEditorMode && (
            <button
              onClick={handleDeleteRequest}
              className="text-zinc-600 hover:text-red-400 transition-colors p-1"
              title="Supprimer le bloc"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>

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

      <ConfirmModal
        isOpen={showConfirmDelete}
        title="Supprimer le bloc ?"
        message={`Ce bloc contient ${block.kind === 'links' ? block.links.length : 0} lien(s). Êtes-vous sûr de vouloir le supprimer ?`}
        onConfirm={() => {
          setShowConfirmDelete(false);
          deleteBlock(block.id);
        }}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </>
  );
};
