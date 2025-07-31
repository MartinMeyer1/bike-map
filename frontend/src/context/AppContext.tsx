import React, { createContext, useReducer, useCallback, useEffect } from 'react';
import { User, MapBounds, Trail } from '../types';
import { CachedTrail } from '../services/trailCache';
import trailCache from '../services/trailCache';
import { PocketBaseService } from '../services/pocketbase';
import { handleApiError, getErrorMessage } from '../utils/errorHandling';

interface AppState {
  // Auth state
  user: User | null;
  isAuthLoading: boolean;
  
  // Trail state
  trails: CachedTrail[];
  visibleTrails: CachedTrail[];
  selectedTrail: CachedTrail | null;
  mapBounds: MapBounds | null;
  isTrailsLoading: boolean;
  
  // UI state
  isUploadPanelVisible: boolean;
  isEditPanelVisible: boolean;
  trailToEdit: CachedTrail | null;
  
  // Drawing state
  isDrawingActive: boolean;
  drawingMode: 'upload' | 'edit' | null;
  drawnGpxContent: { upload?: string; edit?: string };
  
  // General state
  error: string;
  mapMoveEndTrigger: number;
}

type AppAction =
  // Auth actions
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_AUTH_LOADING'; payload: boolean }
  
  // Trail actions
  | { type: 'SET_TRAILS'; payload: CachedTrail[] }
  | { type: 'SET_VISIBLE_TRAILS'; payload: CachedTrail[] }
  | { type: 'SET_SELECTED_TRAIL'; payload: CachedTrail | null }
  | { type: 'SET_MAP_BOUNDS'; payload: MapBounds | null }
  | { type: 'SET_TRAILS_LOADING'; payload: boolean }
  
  // UI actions
  | { type: 'SET_UPLOAD_PANEL_VISIBLE'; payload: boolean }
  | { type: 'SET_EDIT_PANEL_VISIBLE'; payload: boolean }
  | { type: 'SET_TRAIL_TO_EDIT'; payload: CachedTrail | null }
  
  // Drawing actions
  | { type: 'START_DRAWING'; payload: 'upload' | 'edit' }
  | { type: 'COMPLETE_DRAWING'; payload: { mode: 'upload' | 'edit'; gpxContent: string } }
  | { type: 'CANCEL_DRAWING' }
  | { type: 'CLEAR_DRAWN_CONTENT'; payload: 'upload' | 'edit' }
  
  // General actions
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'INCREMENT_MAP_MOVE_TRIGGER' };

const initialState: AppState = {
  // Auth state
  user: null,
  isAuthLoading: true,
  
  // Trail state
  trails: [],
  visibleTrails: [],
  selectedTrail: null,
  mapBounds: null,
  isTrailsLoading: true,
  
  // UI state
  isUploadPanelVisible: false,
  isEditPanelVisible: false,
  trailToEdit: null,
  
  // Drawing state
  isDrawingActive: false,
  drawingMode: null,
  drawnGpxContent: {},
  
  // General state
  error: '',
  mapMoveEndTrigger: 0
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // Auth actions
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_AUTH_LOADING':
      return { ...state, isAuthLoading: action.payload };
    
    // Trail actions
    case 'SET_TRAILS':
      return { ...state, trails: action.payload };
    case 'SET_VISIBLE_TRAILS':
      return { ...state, visibleTrails: action.payload };
    case 'SET_SELECTED_TRAIL':
      return { ...state, selectedTrail: action.payload };
    case 'SET_MAP_BOUNDS':
      return { ...state, mapBounds: action.payload };
    case 'SET_TRAILS_LOADING':
      return { ...state, isTrailsLoading: action.payload };
    
    // UI actions
    case 'SET_UPLOAD_PANEL_VISIBLE':
      return { ...state, isUploadPanelVisible: action.payload };
    case 'SET_EDIT_PANEL_VISIBLE':
      return { ...state, isEditPanelVisible: action.payload };
    case 'SET_TRAIL_TO_EDIT':
      return { ...state, trailToEdit: action.payload };
    
    // Drawing actions
    case 'START_DRAWING':
      return { 
        ...state, 
        isDrawingActive: true, 
        drawingMode: action.payload,
        isUploadPanelVisible: false,
        isEditPanelVisible: false
      };
    case 'COMPLETE_DRAWING':
      return { 
        ...state, 
        isDrawingActive: false,
        drawnGpxContent: {
          ...state.drawnGpxContent,
          [action.payload.mode]: action.payload.gpxContent
        }
      };
    case 'CANCEL_DRAWING':
      return { 
        ...state, 
        isDrawingActive: false, 
        drawingMode: null 
      };
    case 'CLEAR_DRAWN_CONTENT':
      return {
        ...state,
        drawnGpxContent: {
          ...state.drawnGpxContent,
          [action.payload]: undefined
        }
      };
    
    // General actions
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
  // Auth methods
  login: () => Promise<User | null>;
  logout: () => void;
  updateUser: (user: User) => void;
  
  // Trail methods
  initializeTrails: () => Promise<void>;
  refreshTrails: () => void;
  updateVisibleTrails: (bounds: MapBounds) => void;
  selectTrail: (trail: CachedTrail | null) => void;
  handleTrailCreated: (newTrail: Trail) => Promise<void>;
  handleTrailUpdated: (updatedTrail: Trail) => Promise<void>;
  handleTrailDeleted: (trailId: string) => void;
  
  // UI methods
  showUploadPanel: () => void;
  hideUploadPanel: () => void;
  showEditPanel: (trail: CachedTrail) => void;
  hideEditPanel: () => void;
  
  // Drawing methods
  startDrawing: (mode: 'upload' | 'edit') => void;
  completeDrawing: (gpxContent: string) => void;
  cancelDrawing: () => void;
  clearDrawnContent: (mode: 'upload' | 'edit') => void;
  getGpxContent: (mode: 'upload' | 'edit') => string | undefined;
  getPreviousGpxContent: (mode: 'upload' | 'edit') => string | undefined;
  
  // General methods
  setError: (error: string) => void;
  clearError: () => void;
  incrementMapMoveTrigger: () => void;
}

export const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Trail methods  
  const initializeTrails = useCallback(async () => {
    try {
      dispatch({ type: 'SET_TRAILS_LOADING', payload: true });
      await trailCache.initialize();
      const cachedTrails = trailCache.getAllTrails();
      dispatch({ type: 'SET_TRAILS', payload: cachedTrails });
      dispatch({ type: 'SET_VISIBLE_TRAILS', payload: cachedTrails });
    } catch (err) {
      console.error('Failed to initialize trails:', err);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load trails' });
    } finally {
      dispatch({ type: 'SET_TRAILS_LOADING', payload: false });
    }
  }, []);

  // Initialize auth and trails on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize auth
        const currentUser = PocketBaseService.getCurrentUser();
        dispatch({ type: 'SET_USER', payload: currentUser });
        dispatch({ type: 'SET_AUTH_LOADING', payload: false });

        // Set up auth change listener
        const unsubscribe = PocketBaseService.onAuthChange((newUser) => {
          dispatch({ type: 'SET_USER', payload: newUser });
        });

        // Initialize trails
        await initializeTrails();

        return unsubscribe;
      } catch (error) {
        console.error('Failed to initialize app:', error);
        dispatch({ type: 'SET_ERROR', payload: getErrorMessage(error) });
        dispatch({ type: 'SET_AUTH_LOADING', payload: false });
        dispatch({ type: 'SET_TRAILS_LOADING', payload: false });
      }
    };

    const cleanup = initializeApp();
    return () => {
      cleanup.then(unsubscribe => unsubscribe && unsubscribe());
    };
  }, [initializeTrails]);

  // Auth methods
  const login = useCallback(async () => {
    try {
      const user = await PocketBaseService.loginWithGoogle();
      dispatch({ type: 'SET_USER', payload: user });
      return user;
    } catch (error) {
      const appError = handleApiError(error);
      dispatch({ type: 'SET_ERROR', payload: appError.message });
      throw appError;
    }
  }, []);

  const logout = useCallback(() => {
    PocketBaseService.logout();
    dispatch({ type: 'SET_USER', payload: null });
  }, []);

  const updateUser = useCallback((user: User) => {
    dispatch({ type: 'SET_USER', payload: user });
  }, []);

  const refreshTrails = useCallback(() => {
    const cachedTrails = trailCache.getAllTrails();
    dispatch({ type: 'SET_TRAILS', payload: cachedTrails });
    
    if (state.mapBounds) {
      const boundsFiltered = trailCache.getTrailsInBounds(state.mapBounds);
      dispatch({ type: 'SET_VISIBLE_TRAILS', payload: boundsFiltered });
    } else {
      dispatch({ type: 'SET_VISIBLE_TRAILS', payload: cachedTrails });
    }
  }, [state.mapBounds]);

  const updateVisibleTrails = useCallback((bounds: MapBounds) => {
    dispatch({ type: 'SET_MAP_BOUNDS', payload: bounds });
    const boundsFiltered = trailCache.getTrailsInBounds(bounds);
    dispatch({ type: 'SET_VISIBLE_TRAILS', payload: boundsFiltered });
  }, []);

  const selectTrail = useCallback((trail: CachedTrail | null) => {
    dispatch({ type: 'SET_SELECTED_TRAIL', payload: trail });
  }, []);

  const handleTrailCreated = useCallback(async (newTrail: Trail) => {
    try {
      await trailCache.addTrail(newTrail);
      setTimeout(() => {
        refreshTrails();
      }, 1000);
    } catch (error) {
      console.error('Failed to add trail to cache:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to process uploaded trail' });
    }
  }, [refreshTrails]);

  const handleTrailUpdated = useCallback(async (updatedTrail: Trail) => {
    try {
      await trailCache.updateTrail(updatedTrail);
      setTimeout(() => {
        refreshTrails();
      }, 1000);
    } catch (error) {
      console.error('Failed to update trail in cache:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update trail' });
    }
  }, [refreshTrails]);

  const handleTrailDeleted = useCallback((trailId: string) => {
    try {
      trailCache.removeTrail(trailId);
      
      if (state.selectedTrail?.id === trailId) {
        dispatch({ type: 'SET_SELECTED_TRAIL', payload: null });
      }
      
      refreshTrails();
    } catch (error) {
      console.error('Failed to remove trail from cache:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to remove trail' });
    }
  }, [state.selectedTrail, refreshTrails]);

  // UI methods
  const showUploadPanel = useCallback(() => {
    dispatch({ type: 'SET_UPLOAD_PANEL_VISIBLE', payload: true });
  }, []);

  const hideUploadPanel = useCallback(() => {
    dispatch({ type: 'SET_UPLOAD_PANEL_VISIBLE', payload: false });
    dispatch({ type: 'CLEAR_DRAWN_CONTENT', payload: 'upload' });
  }, []);

  const showEditPanel = useCallback((trail: CachedTrail) => {
    dispatch({ type: 'SET_TRAIL_TO_EDIT', payload: trail });
    dispatch({ type: 'SET_EDIT_PANEL_VISIBLE', payload: true });
  }, []);

  const hideEditPanel = useCallback(() => {
    dispatch({ type: 'SET_EDIT_PANEL_VISIBLE', payload: false });
    dispatch({ type: 'SET_TRAIL_TO_EDIT', payload: null });
    dispatch({ type: 'CLEAR_DRAWN_CONTENT', payload: 'edit' });
  }, []);

  // Drawing methods
  const startDrawing = useCallback((mode: 'upload' | 'edit') => {
    dispatch({ type: 'START_DRAWING', payload: mode });
  }, []);

  const completeDrawing = useCallback((gpxContent: string) => {
    if (state.drawingMode) {
      dispatch({ type: 'COMPLETE_DRAWING', payload: { mode: state.drawingMode, gpxContent } });
    }
  }, [state.drawingMode]);

  const cancelDrawing = useCallback(() => {
    dispatch({ type: 'CANCEL_DRAWING' });
  }, []);

  const clearDrawnContent = useCallback((mode: 'upload' | 'edit') => {
    dispatch({ type: 'CLEAR_DRAWN_CONTENT', payload: mode });
  }, []);

  const getGpxContent = useCallback((mode: 'upload' | 'edit') => {
    return state.drawnGpxContent[mode];
  }, [state.drawnGpxContent]);

  const getPreviousGpxContent = useCallback((mode: 'upload' | 'edit') => {
    return state.drawnGpxContent[mode];
  }, [state.drawnGpxContent]);

  // General methods
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
    login,
    logout,
    updateUser,
    initializeTrails,
    refreshTrails,
    updateVisibleTrails,
    selectTrail,
    handleTrailCreated,
    handleTrailUpdated,
    handleTrailDeleted,
    showUploadPanel,
    hideUploadPanel,
    showEditPanel,
    hideEditPanel,
    startDrawing,
    completeDrawing,
    cancelDrawing,
    clearDrawnContent,
    getGpxContent,
    getPreviousGpxContent,
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