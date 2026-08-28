import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Link, LinkDisplayMode, IconStackDirection } from '../types';
import { useLayout } from '../context/LayoutContext';
import { LinkModal, type LinkModalSavedDetails } from './LinkModal';
import { fetchLinkStatus, type LinkStatusBucket } from '../api/client';

interface LinkItemProps {
  link: Link;
  displayMode?: LinkDisplayMode;
  /** Only meaningful when displayMode is 'iconOnly' -- see StatusDot/SecondaryIcon pairing below. */
  iconStackDirection?: IconStackDirection;
}

const STATUS_DOT_COLOR: Record<LinkStatusBucket, string> = {
  up: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  down: 'bg-red-500',
};

const STATUS_DOT_LABEL: Record<LinkStatusBucket, string> = {
  up: 'En ligne',
  degraded: 'Répond, mais pas normalement',
  down: 'Hors ligne ou injoignable',
};

function StatusDot({ url, size }: { url: string; size: 'sm' | 'lg' }) {
  const [bucket, setBucket] = useState<LinkStatusBucket | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBucket(null);
    fetchLinkStatus(url).then((result) => {
      if (!cancelled) setBucket(result);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const dim = size === 'lg' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';
  return (
    <span
      title={bucket ? STATUS_DOT_LABEL[bucket] : 'Vérification en cours...'}
      className={`block rounded-full shrink-0 ${dim} ${
        bucket ? STATUS_DOT_COLOR[bucket] : 'bg-zinc-600 animate-pulse'
      }`}
    />
  );
}

function SecondaryIcon({ url, size }: { url: string; size: 'sm' | 'lg' }) {
  const [imgError, setImgError] = useState(false);
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    // Ignore URL parse error
  }
  const iconUrl = !imgError && domain ? `/api/favicons/${domain}` : null;
  const box = size === 'lg' ? 'w-7 h-7' : 'w-4 h-4';
  const dim = size === 'lg' ? 'w-5 h-5' : 'w-3 h-3';
  // A favicon's own colors are unpredictable -- a dark logo (e.g. GitHub's)
  // would otherwise all but vanish against this app's dark surfaces. The
  // SVG fallback doesn't need it, it already matches the app's icon look.
  const chipBg = iconUrl ? 'bg-zinc-200' : '';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      className={`flex items-center justify-center ${box} shrink-0 rounded ${chipBg} text-zinc-500 hover:text-indigo-400 transition-colors`}
    >
      {iconUrl ? (
        <img src={iconUrl} alt="" className={`${dim} rounded object-contain`} onError={() => setImgError(true)} />
      ) : (
        <svg className={dim} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      )}
    </a>
  );
}

export const LinkItem: React.FC<LinkItemProps> = ({
  link,
  displayMode = 'iconAndText',
  iconStackDirection = 'vertical',
}) => {
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

  // Icon-only mode has no surrounding tile chrome, so the icon itself
  // carries the weight -- render it noticeably larger than the icon+text row.
  const largeIcon = iconUrl ? (
    <img src={iconUrl} alt="" className="w-8 h-8 rounded object-contain" onError={() => setImgError(true)} />
  ) : (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );

  const primaryContent = link.showStatusDot ? <StatusDot url={link.url} size="sm" /> : icon;
  const primaryContentLarge = link.showStatusDot ? <StatusDot url={link.url} size="lg" /> : largeIcon;

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

  const handleSave = (details: LinkModalSavedDetails) => {
    setIsEditModalOpen(false);
    updateLinkDetails(link.id, details);
  };

  const editModal = (
    <LinkModal
      isOpen={isEditModalOpen}
      title="Éditer le lien"
      initialUrl={link.url}
      initialTitle={link.title}
      initialFaviconOverride={link.faviconOverride}
      initialSecondaryUrl={link.secondaryUrl}
      initialShowStatusDot={link.showStatusDot}
      onSave={handleSave}
      onCancel={() => setIsEditModalOpen(false)}
    />
  );

  if (displayMode === 'iconOnly') {
    // The block's own stacking direction decides how *items* flow; the pair
    // inside one item always runs the other way, so a tall vertical stack
    // doesn't grow taller still, and a wide row doesn't grow wider still.
    const pairFlexClass = iconStackDirection === 'horizontal' ? 'flex-col' : 'flex-row';

    return (
      <>
        <div
          ref={setNodeRef}
          style={style}
          {...(isEditorMode ? attributes : {})}
          {...(isEditorMode ? listeners : {})}
          className={`group relative flex ${pairFlexClass} items-center justify-center gap-1 ${
            link.secondaryUrl ? 'p-2' : 'w-14 h-14'
          } shrink-0 rounded-lg text-zinc-300 hover:text-white transition-transform ${
            link.secondaryUrl ? '' : 'hover:scale-110'
          } ${isEditorMode ? 'cursor-grab active:cursor-grabbing' : ''} ${
            isDragging ? 'ring-2 ring-indigo-500/50 z-30 rounded-lg' : ''
          }`}
        >
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={link.title || link.url}
            onClick={(e) => isEditorMode && e.preventDefault()}
            className="flex items-center justify-center w-14 h-14 shrink-0"
          >
            {primaryContentLarge}
          </a>

          {link.secondaryUrl && <SecondaryIcon url={link.secondaryUrl} size="lg" />}

          {isEditorMode && (
            <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 rounded-md border border-zinc-800 p-0.5">
              {editControls}
            </div>
          )}
        </div>

        {editModal}
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
            {primaryContent}
          </div>
          <span className="truncate font-medium">{link.title || link.url}</span>
        </a>

        <div className="flex items-center gap-1">
          {link.secondaryUrl && <SecondaryIcon url={link.secondaryUrl} size="sm" />}
          {isEditorMode && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {editControls}
            </div>
          )}
        </div>
      </div>

      {editModal}
    </>
  );
};
