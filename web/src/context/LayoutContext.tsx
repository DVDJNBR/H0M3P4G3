import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
import type { Layout, Column, Block, Link } from '../types';
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
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const initialState: State = {
  layout: null,
  isAuthenticated: true,
  isLoading: true,
  error: null,
};

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
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
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
  renameColumn: (columnId: string, newTitle: string) => Promise<void>;
  deleteColumn: (columnId: string) => Promise<void>;
  addBlock: (columnId: string) => Promise<void>;
  renameBlock: (blockId: string, newTitle: string) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;
  addLink: (blockId: string, url: string, title?: string, faviconOverride?: string) => Promise<void>;
  updateLinkDetails: (linkId: string, url: string, title: string, faviconOverride?: string) => Promise<void>;
  deleteLink: (linkId: string) => Promise<void>;
}

const LayoutContext = createContext<ContextValue | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(layoutReducer, initialState);
  const [isEditorMode, setIsEditorMode] = useState(false);

  const toggleEditorMode = useCallback(() => {
    setIsEditorMode((prev) => !prev);
  }, []);

  const loadLayout = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const data = await fetchLayout();
      dispatch({ type: 'SET_LAYOUT', payload: data });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
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
      title: 'Nouvelle colonne',
      blocks: [],
    };
    const updated: Layout = {
      columns: [...state.layout.columns, newCol],
    };
    await saveLayout(updated);
  }, [state.layout, saveLayout]);

  const renameColumn = useCallback(
    async (columnId: string, newTitle: string) => {
      if (!state.layout) return;
      const updated: Layout = {
        columns: state.layout.columns.map((col) =>
          col.id === columnId ? { ...col, title: newTitle } : col,
        ),
      };
      await saveLayout(updated);
    },
    [state.layout, saveLayout],
  );

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
    async (columnId: string) => {
      if (!state.layout) return;
      const newBlock: Block = {
        kind: 'links',
        id: nanoid(),
        title: 'Nouveau bloc',
        links: [],
      };
      const updated: Layout = {
        columns: state.layout.columns.map((col) =>
          col.id === columnId ? { ...col, blocks: [...col.blocks, newBlock] } : col,
        ),
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
        renameColumn,
        deleteColumn,
        addBlock,
        renameBlock,
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
