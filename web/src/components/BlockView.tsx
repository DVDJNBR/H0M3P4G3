import React, { useState, useEffect, useRef } from 'react';
import { useSortable, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block, Link } from '../types';
import { useLayout } from '../context/LayoutContext';
import { LinkItem } from './LinkItem';
import { ConfirmModal } from './ConfirmModal';
import { LinkModal } from './LinkModal';
import { RaindropBlockModal } from './RaindropBlockModal';
import { HtmlBlockModal } from './HtmlBlockModal';
import { HtmlBlockView } from './HtmlBlockView';
import { fetchRaindropCache, type RaindropCacheMap } from '../api/client';

// Above this, a links block's longest entry needs the mosaic's wide track
// to avoid truncating; at or under it, the narrow track fits comfortably.
const WIDE_TRACK_CHAR_THRESHOLD = 22;

function longestLinkLabelLength(block: Block): number {
  if (block.kind !== 'links') return 0;
  return block.links.reduce((max, l) => Math.max(max, (l.title || l.url).length), 0);
}

interface BlockViewProps {
  block: Block;
}

export const BlockView: React.FC<BlockViewProps> = ({ block }) => {
  const {
    isEditorMode,
    deleteBlock,
    addLink,
    updateRaindropBlock,
    updateHtmlBlockContent,
  } = useLayout();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [showEditRaindropModal, setShowEditRaindropModal] = useState(false);
  const [showEditHtmlModal, setShowEditHtmlModal] = useState(false);
  const [raindropData, setRaindropData] = useState<RaindropCacheMap[string] | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // Default anchor is the block's right edge (grows left, see className
  // below) -- safe for every block except one narrow enough, near enough
  // to the viewport's left edge, that the toolbar's own width pushes past
  // it. Checked on hover, when the toolbar's real (already-rendered but
  // invisible) position is measurable, and flipped to the left edge
  // (grows right) only then.
  const [anchorLeft, setAnchorLeft] = useState(false);

  const handleMouseEnter = () => {
    const rect = toolbarRef.current?.getBoundingClientRect();
    if (rect) setAnchorLeft(rect.left < 8);
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: !isEditorMode,
  });

  const linkIds = block.kind === 'links' ? block.links.map((l) => l.id) : [];
  // Mosaic width: a links block with only short entries fits one narrow
  // track; a long entry (or any non-links block, e.g. Raindrop) needs the
  // wide track -- see LayoutView's grid-template-columns.
  const isNarrow = block.kind === 'links' && longestLinkLabelLength(block) <= WIDE_TRACK_CHAR_THRESHOLD;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    gridColumn: isNarrow ? 'span 1' : 'span 2',
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
        onMouseEnter={handleMouseEnter}
        className={`glass-panel glass-panel-hover rounded-xl p-4 flex flex-col gap-3 group relative ${
          isDragging ? 'ring-2 ring-indigo-500/50 z-30' : ''
        }`}
      >
        {isEditorMode && (
          <div
            ref={toolbarRef}
            className={`absolute -top-3 z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity ${
              anchorLeft ? 'left-0' : 'right-0'
            }`}
          >
            <div className="flex items-center gap-0.5 glass-panel rounded-lg shadow-lg p-1">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-200 p-1"
                title="Glisser pour déplacer le bloc"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
              </div>

              {block.kind === 'links' && (
                <button
                  onClick={() => setShowAddLinkModal(true)}
                  className="text-zinc-500 hover:text-indigo-400 p-1 transition-colors"
                  title="Ajouter un lien"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              {block.kind === 'html' && (
                <button
                  onClick={() => setShowEditHtmlModal(true)}
                  className="text-zinc-500 hover:text-indigo-400 p-1 transition-colors"
                  title="Éditer le HTML"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.3H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
              )}
              <button
                onClick={handleDeleteRequest}
                className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                title="Supprimer le bloc"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {block.kind === 'raindrop' && isStale && (
          <span className="self-start text-[10px] text-amber-400 font-normal px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
            Hors ligne / Obsolète
          </span>
        )}

        {block.kind === 'links' && (
          <SortableContext items={linkIds} strategy={rectSortingStrategy}>
            <div className="flex flex-col gap-1.5 min-h-[20px]">
              {block.links.length === 0 ? (
                <p className="text-xs text-zinc-600 italic py-2">
                  {isEditorMode ? 'Cliquez sur + pour ajouter un lien' : 'Aucun lien'}
                </p>
              ) : (
                block.links.map((link: Link) => <LinkItem key={link.id} link={link} />)
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
                  className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/40 hover:border-zinc-700/60 transition-all text-xs text-zinc-300 hover:text-white"
                >
                  {item.cover && (
                    <img
                      src={item.cover}
                      alt=""
                      loading="lazy"
                      className="w-10 h-10 rounded-md object-cover shrink-0 bg-zinc-800"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex items-center justify-between min-w-0 flex-1">
                    <span className="truncate font-medium">{item.title}</span>
                    <span className="text-[10px] text-zinc-500 font-mono shrink-0 ml-2">
                      {item.domain}
                    </span>
                  </div>
                </a>
              ))
            )}
          </div>
        )}

        {block.kind === 'html' && <HtmlBlockView content={block.content} />}
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
        onSave={(details) => {
          setShowAddLinkModal(false);
          addLink(block.id, details);
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

      {block.kind === 'html' && (
        <HtmlBlockModal
          isOpen={showEditHtmlModal}
          title="Éditer le bloc HTML"
          initialContent={block.content}
          onSave={(content) => {
            setShowEditHtmlModal(false);
            updateHtmlBlockContent(block.id, content);
          }}
          onCancel={() => setShowEditHtmlModal(false)}
        />
      )}
    </>
  );
};
