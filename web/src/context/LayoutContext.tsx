import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { Layout } from '../types';
import { fetchLayout, ApiError } from '../api/client';

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
  isAuthenticated: true, // Assume true initially, 401 will flip to false
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
  loadLayout: () => Promise<void>;
  markAuthenticated: () => void;
}

const LayoutContext = createContext<ContextValue | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(layoutReducer, initialState);

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

  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  return (
    <LayoutContext.Provider
      value={{
        ...state,
        loadLayout,
        markAuthenticated,
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
