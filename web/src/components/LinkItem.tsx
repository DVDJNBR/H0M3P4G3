import React, { useState } from 'react';
import type { Link } from '../types';

interface LinkItemProps {
  link: Link;
}

export const LinkItem: React.FC<LinkItemProps> = ({ link }) => {
  const [imgError, setImgError] = useState(false);

  // Favicon override wins if present, otherwise no external calls at page-load (NFR-5).
  // We can render favicon override if present and valid.
  const iconUrl = !imgError && link.faviconOverride ? link.faviconOverride : null;

  return (
    <a
      href={link.url}
      target="_self"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/40 hover:border-zinc-700/60 transition-all text-sm text-zinc-200 hover:text-white"
    >
      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 bg-zinc-800 text-zinc-400 group-hover:text-indigo-400 group-hover:bg-zinc-700/50 transition-colors">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            className="w-4 h-4 rounded object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        )}
      </div>
      <span className="truncate font-medium">{link.title || link.url}</span>
    </a>
  );
};
