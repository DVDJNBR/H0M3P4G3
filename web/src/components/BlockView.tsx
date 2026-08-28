import React, { useState, useEffect } from 'react';
import { useSortable, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block, Link } from '../types';
import { useLayout } from '../context/LayoutContext';
import { LinkItem } from './LinkItem';
import { ConfirmModal } from './ConfirmModal';
import { LinkModal } from './LinkModal';
import { RaindropBlockModal } from './RaindropBlockModal';
import { fetchRaindropCache, type RaindropCacheMap } from '../api/client';

interface BlockViewProps {
  block: Block;
}

export const BlockView: React.FC<BlockViewProps> = ({ block }) => {
  const {
    isEditorMode,
    deleteBlock,
    addLink,
    updateRaindropBlock,
    setLinksBlockDisplayMode,
    setLinksBlockIconStackDirection,
  } = useLayout();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [showEditRaindropModal, setShowEditRaindropModal] = useState(false);
  const [raindropData, setRaindropData] = useState<RaindropCacheMap[string] | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: !isEditorMode,
  });

  const linkIds = block.kind === 'links' ? block.links.map((l) => l.id) : [];
  const displayMode = block.kind === 'links' ? block.displayMode ?? 'iconAndText' : 'iconAndText';
  const iconStackDirection = block.kind === 'links' ? block.iconStackDirection ?? 'vertical' : 'vertical';
  // Mosaic width: a compact icon-only block stacked vertically is one
  // narrow track; every other shape (icon+text, icons in a row, Raindrop)
  // is two tracks wide -- see LayoutView's grid-template-columns.
  const isCompact = displayMode === 'iconOnly' && iconStackDirection === 'vertical';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    gridColumn: isCompact ? 'span 1' : 'span 2',
  };

  useEffect(() => {
    if (block.kind === 'raindrop') {
      fetchRaindropCache().then((cache) => {
        if (cache[block.collectionId]) {
          setRaindropData(cache[block.collectionId] || null);
        } else {
          setRaindropData(null);
        }
      });
    }
  }, [block]);

  const handleDeleteRequest = () => {
    if (block.kind === 'links' && block.links.length > 0) {
      setShowConfirmDelete(true);
    } else {
      deleteBlock(block.id);
    }
  };

  const isStale = raindropData?.fetchedAt
    ? Date.now() - new Date(raindropData.fetchedAt).getTime() > 20 * 60 * 1000
    : false;

  // No block titles: the block itself is just a lightweight visual grouping,
  // named by nothing -- the header row only earns its place when there's
  // something to show in it (editor controls, or a staleness notice).
  const showHeader = isEditorMode || (block.kind === 'raindrop' && isStale);

  const raindropItems = raindropData?.items
    ? block.kind === 'raindrop' && block.displayCap
      ? raindropData.items.slice(0, block.displayCap)
      : raindropData.items
    : [];

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`glass-panel glass-panel-hover rounded-xl p-4 flex flex-col gap-3 group relative ${
          isDragging ? 'ring-2 ring-indigo-500/50 z-30' : ''
        }`}
      >
        {showHeader && (
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isEditorMode && (
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 p-0.5"
                title="Glisser pour déplacer le bloc"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
              </div>
            )}

            {block.kind === 'raindrop' && isStale && (
              <span className="text-[10px] text-amber-400 font-normal px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20">
                Hors ligne / Obsolète
              </span>
            )}
          </div>

          {isEditorMode && (
            <div className="flex items-center gap-1">
              {block.kind === 'links' && (
                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 mr-1">
                  <button
                    onClick={() => setLinksBlockDisplayMode(block.id, 'iconOnly')}
                    title="Icône seule"
                    className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                      displayMode === 'iconOnly'
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 7a3 3 0 013-3h10a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setLinksBlockDisplayMode(block.id, 'iconAndText')}
                    title="Icône et nom"
                    className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                      displayMode === 'iconAndText'
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
                    </svg>
                  </button>
                </div>
              )}
              {block.kind === 'links' && displayMode === 'iconOnly' && (
                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 mr-1">
                  <button
                    onClick={() => setLinksBlockIconStackDirection(block.id, 'vertical')}
                    title="Empilement vertical"
                    className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                      iconStackDirection === 'vertical'
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m-4-4l4 4 4-4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setLinksBlockIconStackDirection(block.id, 'horizontal')}
                    title="Empilement horizontal"
                    className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                      iconStackDirection === 'horizontal'
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16m-4-4l4 4-4 4" />
                    </svg>
                  </button>
                </div>
              )}
              {block.kind === 'links' && (
                <button
                  onClick={() => setShowAddLinkModal(true)}
                  className="text-zinc-500 hover:text-indigo-400 p-1 transition-colors"
                  title="Ajouter un lien"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
              {block.kind === 'raindrop' && (
                <button
                  onClick={() => setShowEditRaindropModal(true)}
                  className="text-zinc-500 hover:text-indigo-400 p-1 transition-colors"
                  title="Configurer la collection Raindrop"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>
              )}
              <button
                onClick={handleDeleteRequest}
                className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                title="Supprimer le bloc"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
        )}

        {block.kind === 'links' && (
          <SortableContext items={linkIds} strategy={rectSortingStrategy}>
            <div
              className={`gap-1.5 min-h-[20px] ${
                displayMode === 'iconOnly'
                  ? iconStackDirection === 'horizontal'
                    ? 'flex flex-row flex-wrap justify-center'
                    : 'flex flex-col items-center'
                  : 'flex flex-col'
              }`}
            >
              {block.links.length === 0 ? (
                <p className="text-xs text-zinc-600 italic py-2">
                  {isEditorMode ? 'Cliquez sur + pour ajouter un lien' : 'Aucun lien'}
                </p>
              ) : (
                block.links.map((link: Link) => (
                  <LinkItem key={link.id} link={link} displayMode={displayMode} />
                ))
              )}
            </div>
          </SortableContext>
        )}

        {block.kind === 'raindrop' && (
          <div className="flex flex-col gap-1.5">
            {raindropItems.length === 0 ? (
              <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/40 text-xs text-zinc-500 italic flex items-center justify-between">
                <span>Collection indisponible ou vide ({block.collectionId || 'non configurée'})</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-400 font-mono shrink-0 ml-2">
                  Raindrop.io
                </span>
              </div>
            ) : (
              raindropItems.map((item) => (
                <a
                  key={item.id}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/40 hover:border-zinc-700/60 transition-all text-xs text-zinc-300 hover:text-white"
                >
                  <span className="truncate font-medium">{item.title}</span>
                  <span className="text-[10px] text-zinc-500 font-mono shrink-0 ml-2">
                    {item.domain}
                  </span>
                </a>
              ))
            )}
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

      <LinkModal
        isOpen={showAddLinkModal}
        title="Ajouter un lien"
        onSave={(url, title, faviconOverride) => {
          setShowAddLinkModal(false);
          addLink(block.id, url, title, faviconOverride);
        }}
        onCancel={() => setShowAddLinkModal(false)}
      />

      {block.kind === 'raindrop' && (
        <RaindropBlockModal
          isOpen={showEditRaindropModal}
          title="Configurer le bloc Raindrop"
          initialCollectionId={block.collectionId}
          initialDisplayCap={block.displayCap}
          onSave={(newCollectionId, newDisplayCap) => {
            setShowEditRaindropModal(false);
            updateRaindropBlock(block.id, {
              collectionId: newCollectionId,
              displayCap: newDisplayCap,
            });
          }}
          onCancel={() => setShowEditRaindropModal(false)}
        />
      )}
    </>
  );
};
