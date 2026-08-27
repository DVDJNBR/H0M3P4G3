import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
import type { Layout, Column, Block, Link, LinkDisplayMode } from '../types';
import { fetchLayout, updateLayout, ApiError } from '../api/client';
import { nanoid } from 'nanoid';

interface State {
  layout: Layout | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

type Action =
  | { type: 'SET_LAYOUT'; payload: Layout }
  | { type: 'SET_UNAUTHENTICATED' }
  | { type: 'SET_AUTHENTICATED' }
  | { type: 'FETCH_START' }
  | { type: 'SET_ERROR'; payload: string | null };

const CACHED_LAYOUT_KEY = 'h0m3p4g3:cachedLayout';

function readCachedLayout(): Layout | null {
  try {
    const raw = localStorage.getItem(CACHED_LAYOUT_KEY);
    return raw ? (JSON.parse(raw) as Layout) : null;
  } catch {
    return null;
  }
}

function writeCachedLayout(layout: Layout): void {
  try {
    localStorage.setItem(CACHED_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Storage unavailable (private mode, quota) -- cache is a pure
    // optimization, safe to skip.
  }
}

function clearCachedLayout(): void {
  try {
    localStorage.removeItem(CACHED_LAYOUT_KEY);
  } catch {
    // Ignore
  }
}

function createInitialState(): State {
  const cached = readCachedLayout();
  return {
    layout: cached,
    isAuthenticated: true,
    isLoading: cached === null,
    error: null,
  };
  // A cached layout paints immediately while loadLayout() revalidates in
  // the background -- no cache means a genuine first load, spinner-gated.
}

function layoutReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_LAYOUT':
      return {
        ...state,
        layout: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'SET_UNAUTHENTICATED':
      return {
        ...state,
        layout: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'SET_AUTHENTICATED':
      return {
        ...state,
        isAuthenticated: true,
        isLoading: true,
      };
    case 'FETCH_START':
      if (state.layout) return state;
      return {
        ...state,
        isLoading: true,
      };
      // Only gates on a spinner when there's nothing cached to show yet --
      // a cached layout keeps painting while this fetch revalidates it.
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    default:
      return state;
  }
}

interface ContextValue extends State {
  isEditorMode: boolean;
  toggleEditorMode: () => void;
  loadLayout: () => Promise<void>;
  markAuthenticated: () => void;
  saveLayout: (newLayout: Layout) => Promise<void>;
  addColumn: () => Promise<void>;
  deleteColumn: (columnId: string) => Promise<void>;
  addBlock: (
    columnId: string,
    blockConfig?: { kind?: 'links' | 'raindrop'; title?: string; collectionId?: string; displayCap?: number },
  ) => Promise<void>;
  updateRaindropBlock: (
    blockId: string,
    details: { title: string; collectionId: string; displayCap?: number },
  ) => Promise<void>;
  renameBlock: (blockId: string, newTitle: string) => Promise<void>;
  setLinksBlockDisplayMode: (blockId: string, displayMode: LinkDisplayMode) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;
  addLink: (blockId: string, url: string, title?: string, faviconOverride?: string) => Promise<void>;
  updateLinkDetails: (linkId: string, url: string, title: string, faviconOverride?: string) => Promise<void>;
  deleteLink: (linkId: string) => Promise<void>;
}

const LayoutContext = createContext<ContextValue | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(layoutReducer, undefined, createInitialState);
  const [isEditorMode, setIsEditorMode] = useState(false);

  const toggleEditorMode = useCallback(() => {
    setIsEditorMode((prev) => !prev);
  }, []);

  const loadLayout = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      const data = await fetchLayout();
      writeCachedLayout(data);
      dispatch({ type: 'SET_LAYOUT', payload: data });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearCachedLayout();
        dispatch({ type: 'SET_UNAUTHENTICATED' });
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to load layout';
        dispatch({ type: 'SET_ERROR', payload: msg });
      }
    }
  }, []);

  const markAuthenticated = useCallback(() => {
    dispatch({ type: 'SET_AUTHENTICATED' });
    loadLayout();
  }, [loadLayout]);

  const saveLayout = useCallback(
    async (newLayout: Layout) => {
      const previousLayout = state.layout;
      dispatch({ type: 'SET_LAYOUT', payload: newLayout });

      try {
        const canonical = await updateLayout(newLayout);
        writeCachedLayout(canonical);
        dispatch({ type: 'SET_LAYOUT', payload: canonical });
      } catch (err) {
        if (previousLayout) {
          dispatch({ type: 'SET_LAYOUT', payload: previousLayout });
        }
        const msg = err instanceof Error ? err.message : 'Failed to update layout';
        dispatch({ type: 'SET_ERROR', payload: msg });
      }
    },
    [state.layout],
  );

  const addColumn = useCallback(async () => {
    if (!state.layout) return;
    const newCol: Column = {
      id: nanoid(),
      blocks: [],
    };
    const updated: Layout = {
      columns: [...state.layout.columns, newCol],
    };
    await saveLayout(updated);
  }, [state.layout, saveLayout]);

  const deleteColumn = useCallback(
    async (columnId: string) => {
      if (!state.layout) return;
      const updated: Layout = {
        columns: state.layout.columns.filter((col) => col.id !== columnId),
      };
      await saveLayout(updated);
    },
    [state.layout, saveLayout],
  );

  const addBlock = useCallback(
    async (
      columnId: string,
      blockConfig?: { kind?: 'links' | 'raindrop'; title?: string; collectionId?: string; displayCap?: number },
    ) => {
      if (!state.layout) return;
      const kind = blockConfig?.kind || 'links';
      let newBlock: Block;
      if (kind === 'raindrop') {
        newBlock = {
          kind: 'raindrop',
          id: nanoid(),
          title: blockConfig?.title?.trim() || 'Raindrop',
          collectionId: blockConfig?.collectionId?.trim() || '',
          displayCap: blockConfig?.displayCap,
        };
      } else {
        newBlock = {
          kind: 'links',
          id: nanoid(),
          title: blockConfig?.title?.trim() || 'Nouveau bloc',
          links: [],
        };
      }
      const updated: Layout = {
        columns: state.layout.columns.map((col) =>
          col.id === columnId ? { ...col, blocks: [...col.blocks, newBlock] } : col,
        ),
      };
      await saveLayout(updated);
    },
    [state.layout, saveLayout],
  );

  const updateRaindropBlock = useCallback(
    async (
      blockId: string,
      details: { title: string; collectionId: string; displayCap?: number },
    ) => {
      if (!state.layout) return;
      const updated: Layout = {
        columns: state.layout.columns.map((col) => ({
          ...col,
          blocks: col.blocks.map((b) => {
            if (b.id === blockId && b.kind === 'raindrop') {
              return {
                ...b,
                title: details.title.trim(),
                collectionId: details.collectionId.trim(),
                displayCap: details.displayCap,
              };
            }
            return b;
          }),
        })),
      };
      await saveLayout(updated);
    },
    [state.layout, saveLayout],
  );

  const renameBlock = useCallback(
    async (blockId: string, newTitle: string) => {
      if (!state.layout) return;
      const updated: Layout = {
        columns: state.layout.columns.map((col) => ({
          ...col,
          blocks: col.blocks.map((b) => (b.id === blockId ? { ...b, title: newTitle } : b)),
        })),
      };
      await saveLayout(updated);
    },
    [state.layout, saveLayout],
  );

  const setLinksBlockDisplayMode = useCallback(
    async (blockId: string, displayMode: LinkDisplayMode) => {
      if (!state.layout) return;
      const updated: Layout = {
        columns: state.layout.columns.map((col) => ({
          ...col,
          blocks: col.blocks.map((b) =>
            b.id === blockId && b.kind === 'links' ? { ...b, displayMode } : b,
          ),
        })),
      };
      await saveLayout(updated);
    },
    [state.layout, saveLayout],
  );

  const deleteBlock = useCallback(
    async (blockId: string) => {
      if (!state.layout) return;
      const updated: Layout = {
        columns: state.layout.columns.map((col) => ({
          ...col,
          blocks: col.blocks.filter((b) => b.id !== blockId),
        })),
      };
      await saveLayout(updated);
    },
    [state.layout, saveLayout],
  );

  const addLink = useCallback(
    async (blockId: string, url: string, title?: string, faviconOverride?: string) => {
      if (!state.layout) return;
      let finalTitle = title?.trim();
      if (!finalTitle) {
        try {
          finalTitle = new URL(url).hostname.replace(/^www\./, '');
        } catch {
          finalTitle = url;
        }
      }

      const newLink: Link = {
        id: nanoid(),
        url: url.trim(),
        title: finalTitle,
        faviconOverride: faviconOverride?.trim() || undefined,
      };

      const updated: Layout = {
        columns: state.layout.columns.map((col) => ({
          ...col,
          blocks: col.blocks.map((b) => {
            if (b.id === blockId && b.kind === 'links') {
              return { ...b, links: [...b.links, newLink] };
            }
            return b;
          }),
        })),
      };
      await saveLayout(updated);
    },
    [state.layout, saveLayout],
  );

  const updateLinkDetails = useCallback(
    async (linkId: string, url: string, title: string, faviconOverride?: string) => {
      if (!state.layout) return;
      let finalTitle = title.trim();
      if (!finalTitle) {
        try {
          finalTitle = new URL(url).hostname.replace(/^www\./, '');
        } catch {
          finalTitle = url;
        }
      }

      const updated: Layout = {
        columns: state.layout.columns.map((col) => ({
          ...col,
          blocks: col.blocks.map((b) => {
            if (b.kind === 'links') {
              return {
                ...b,
                links: b.links.map((l) =>
                  l.id === linkId
                    ? {
                        ...l,
                        url: url.trim(),
                        title: finalTitle,
                        faviconOverride: faviconOverride?.trim() || undefined,
                      }
                    : l,
                ),
              };
            }
            return b;
          }),
        })),
      };
      await saveLayout(updated);
    },
    [state.layout, saveLayout],
  );

  const deleteLink = useCallback(
    async (linkId: string) => {
      if (!state.layout) return;
      const updated: Layout = {
        columns: state.layout.columns.map((col) => ({
          ...col,
          blocks: col.blocks.map((b) => {
            if (b.kind === 'links') {
              return { ...b, links: b.links.filter((l) => l.id !== linkId) };
            }
            return b;
          }),
        })),
      };
      await saveLayout(updated);
    },
    [state.layout, saveLayout],
  );

  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  return (
    <LayoutContext.Provider
      value={{
        ...state,
        isEditorMode,
        toggleEditorMode,
        loadLayout,
        markAuthenticated,
        saveLayout,
        addColumn,
        deleteColumn,
        addBlock,
        updateRaindropBlock,
        renameBlock,
        setLinksBlockDisplayMode,
        deleteBlock,
        addLink,
        updateLinkDetails,
        deleteLink,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}
