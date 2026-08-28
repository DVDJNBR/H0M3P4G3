import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Link, LinkDisplayMode } from '../types';
import { useLayout } from '../context/LayoutContext';
import { LinkModal } from './LinkModal';

interface LinkItemProps {
  link: Link;
  displayMode?: LinkDisplayMode;
}

export const LinkItem: React.FC<LinkItemProps> = ({ link, displayMode = 'iconAndText' }) => {
  const { isEditorMode, updateLinkDetails, deleteLink } = useLayout();
  const [imgError, setImgError] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
    disabled: !isEditorMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // AD-8, NFR5: Priority: faviconOverride > same-origin /api/favicons/:domain > SVG fallback
  let domain = '';
  try {
    domain = new URL(link.url).hostname;
  } catch {
    // Ignore URL parse error
  }

  const iconUrl = !imgError
    ? link.faviconOverride || (domain ? `/api/favicons/${domain}` : null)
    : null;

  const icon = iconUrl ? (
    <img src={iconUrl} alt="" className="w-4 h-4 rounded object-contain" onError={() => setImgError(true)} />
  ) : (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );

  const editControls = isEditorMode && (
    <>
      <button
        onClick={() => setIsEditModalOpen(true)}
        className="text-zinc-500 hover:text-indigo-300 p-1"
        title="Éditer le lien"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 210.3H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
      <button
        onClick={() => deleteLink(link.id)}
        className="text-zinc-500 hover:text-red-400 p-1"
        title="Supprimer le lien"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </>
  );

  if (displayMode === 'iconOnly') {
    return (
      <>
        <div
          ref={setNodeRef}
          style={style}
          {...(isEditorMode ? attributes : {})}
          {...(isEditorMode ? listeners : {})}
          className={`group relative flex items-center justify-center w-11 h-11 shrink-0 rounded-lg bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/40 hover:border-zinc-700/60 transition-all text-zinc-300 hover:text-white ${
            isEditorMode ? 'cursor-grab active:cursor-grabbing' : ''
          } ${isDragging ? 'ring-2 ring-indigo-500/50 z-30' : ''}`}
        >
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={link.title || link.url}
            onClick={(e) => isEditorMode && e.preventDefault()}
            className="flex items-center justify-center w-full h-full"
          >
            {icon}
          </a>

          {isEditorMode && (
            <div className="absolute -top-2 -right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 rounded-md border border-zinc-800 p-0.5">
              {editControls}
            </div>
          )}
        </div>

        <LinkModal
          isOpen={isEditModalOpen}
          title="Éditer le lien"
          initialUrl={link.url}
          initialTitle={link.title}
          initialFaviconOverride={link.faviconOverride}
          onSave={(url, title, faviconOverride) => {
            setIsEditModalOpen(false);
            updateLinkDetails(link.id, url, title, faviconOverride);
          }}
          onCancel={() => setIsEditModalOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`group flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/40 hover:border-zinc-700/60 transition-all text-sm text-zinc-200 hover:text-white ${
          isDragging ? 'ring-2 ring-indigo-500/50 z-30' : ''
        }`}
      >
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => isEditorMode && e.preventDefault()}
          className="flex items-center gap-2.5 flex-1 min-w-0"
        >
          {isEditorMode && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 p-0.5"
              title="Glisser pour déplacer le lien"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>
          )}

          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 bg-zinc-800 text-zinc-400 group-hover:text-indigo-400 group-hover:bg-zinc-700/50 transition-colors overflow-hidden">
            {icon}
          </div>
          <span className="truncate font-medium">{link.title || link.url}</span>
        </a>

        {isEditorMode && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {editControls}
          </div>
        )}
      </div>

      <LinkModal
        isOpen={isEditModalOpen}
        title="Éditer le lien"
        initialUrl={link.url}
        initialTitle={link.title}
        initialFaviconOverride={link.faviconOverride}
        onSave={(url, title, faviconOverride) => {
          setIsEditModalOpen(false);
          updateLinkDetails(link.id, url, title, faviconOverride);
        }}
        onCancel={() => setIsEditModalOpen(false)}
      />
    </>
  );
};
