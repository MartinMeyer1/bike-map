import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { User, MapBounds } from '../types';
import { CachedTrail } from '../services/trailCache';

interface AppState {
  user: User | null;
  trails: CachedTrail[];
  visibleTrails: CachedTrail[];
  selectedTrail: CachedTrail | null;
  mapBounds: MapBounds | null;
  isLoading: boolean;
  error: string;
  mapMoveEndTrigger: number;
}

type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_TRAILS'; payload: CachedTrail[] }
  | { type: 'SET_VISIBLE_TRAILS'; payload: CachedTrail[] }
  | { type: 'SET_SELECTED_TRAIL'; payload: CachedTrail | null }
  | { type: 'SET_MAP_BOUNDS'; payload: MapBounds | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'INCREMENT_MAP_MOVE_TRIGGER' };

const initialState: AppState = {
  user: null,
  trails: [],
  visibleTrails: [],
  selectedTrail: null,
  mapBounds: null,
  isLoading: true,
  error: '',
  mapMoveEndTrigger: 0
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_TRAILS':
      return { ...state, trails: action.payload };
    case 'SET_VISIBLE_TRAILS':
      return { ...state, visibleTrails: action.payload };
    case 'SET_SELECTED_TRAIL':
      return { ...state, selectedTrail: action.payload };
    case 'SET_MAP_BOUNDS':
      return { ...state, mapBounds: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: '' };
    case 'INCREMENT_MAP_MOVE_TRIGGER':
      return { ...state, mapMoveEndTrigger: state.mapMoveEndTrigger + 1 };
    default:
      return state;
  }
}

interface AppContextValue extends AppState {
  setUser: (user: User | null) => void;
  setTrails: (trails: CachedTrail[]) => void;
  setVisibleTrails: (trails: CachedTrail[]) => void;
  setSelectedTrail: (trail: CachedTrail | null) => void;
  setMapBounds: (bounds: MapBounds | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  clearError: () => void;
  incrementMapMoveTrigger: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setUser = useCallback((user: User | null) => {
    dispatch({ type: 'SET_USER', payload: user });
  }, []);

  const setTrails = useCallback((trails: CachedTrail[]) => {
    dispatch({ type: 'SET_TRAILS', payload: trails });
  }, []);

  const setVisibleTrails = useCallback((trails: CachedTrail[]) => {
    dispatch({ type: 'SET_VISIBLE_TRAILS', payload: trails });
  }, []);

  const setSelectedTrail = useCallback((trail: CachedTrail | null) => {
    dispatch({ type: 'SET_SELECTED_TRAIL', payload: trail });
  }, []);

  const setMapBounds = useCallback((bounds: MapBounds | null) => {
    dispatch({ type: 'SET_MAP_BOUNDS', payload: bounds });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const incrementMapMoveTrigger = useCallback(() => {
    dispatch({ type: 'INCREMENT_MAP_MOVE_TRIGGER' });
  }, []);

  const contextValue: AppContextValue = {
    ...state,
    setUser,
    setTrails,
    setVisibleTrails,
    setSelectedTrail,
    setMapBounds,
    setLoading,
    setError,
    clearError,
    incrementMapMoveTrigger
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};