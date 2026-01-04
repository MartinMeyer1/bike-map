import React, {
  createContext,
  useReducer,
  useCallback,
  useEffect,
} from "react";
import { User, MapBounds, Trail, MVTTrail } from "../types";
import { PocketBaseService } from "../services/pocketbase";
import { handleApiError, getErrorMessage } from "../utils/errorHandling";

interface AppState {
  // Auth state
  user: User | null;
  isAuthLoading: boolean;

  // Trail state
  visibleTrails: MVTTrail[]; // From MVT layer - only currently visible tiles
  selectedTrail: MVTTrail | null;
  mapBounds: MapBounds | null;
  fitBoundsTarget: MapBounds | null; // Bounds to fit map to (one-time action)

  // UI state
  isUploadPanelVisible: boolean;
  isEditPanelVisible: boolean;
  trailToEdit: MVTTrail | null;

  // Drawing state
  isDrawingActive: boolean;
  drawingMode: "upload" | "edit" | null;
  drawnGpxContent: { upload?: string; edit?: string };

  // General state
  error: string;
  mapMoveEndTrigger: number;
  mvtRefreshTrigger: number;
}

type AppAction =
  // Auth actions
  | { type: "SET_USER"; payload: User | null }
  | { type: "SET_AUTH_LOADING"; payload: boolean }

  // Trail actions
  | { type: "SET_VISIBLE_TRAILS"; payload: MVTTrail[] }
  | { type: "SET_SELECTED_TRAIL"; payload: MVTTrail | null }
  | { type: "SET_MAP_BOUNDS"; payload: MapBounds | null }
  | { type: "FIT_MAP_TO_BOUNDS"; payload: MapBounds | null }

  // UI actions
  | { type: "SET_UPLOAD_PANEL_VISIBLE"; payload: boolean }
  | { type: "SET_EDIT_PANEL_VISIBLE"; payload: boolean }
  | { type: "SET_TRAIL_TO_EDIT"; payload: MVTTrail | null }

  // Drawing actions
  | { type: "START_DRAWING"; payload: "upload" | "edit" }
  | {
      type: "COMPLETE_DRAWING";
      payload: { mode: "upload" | "edit"; gpxContent: string };
    }
  | { type: "CANCEL_DRAWING" }
  | { type: "CLEAR_DRAWN_CONTENT"; payload: "upload" | "edit" }

  // General actions
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" }
  | { type: "INCREMENT_MAP_MOVE_TRIGGER" }
  | { type: "INCREMENT_MVT_REFRESH_TRIGGER" };

const initialState: AppState = {
  // Auth state
  user: null,
  isAuthLoading: true,

  // Trail state
  visibleTrails: [],
  selectedTrail: null,
  mapBounds: null,
  fitBoundsTarget: null,

  // UI state
  isUploadPanelVisible: false,
  isEditPanelVisible: false,
  trailToEdit: null,

  // Drawing state
  isDrawingActive: false,
  drawingMode: null,
  drawnGpxContent: {},

  // General state
  error: "",
  mapMoveEndTrigger: 0,
  mvtRefreshTrigger: 0,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // Auth actions
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_AUTH_LOADING":
      return { ...state, isAuthLoading: action.payload };

    case "SET_VISIBLE_TRAILS": {
      // Optimize: only update if trail IDs actually changed
      const currentIds = new Set(state.visibleTrails.map((t) => t.id));
      const newIds = new Set(action.payload.map((t) => t.id));

      const hasChanged =
        currentIds.size !== newIds.size ||
        [...currentIds].some((id) => !newIds.has(id));

      if (!hasChanged) return state; // Skip update if no changes

      return { ...state, visibleTrails: action.payload };
    }
    case "SET_SELECTED_TRAIL":
      return { ...state, selectedTrail: action.payload };
    case "SET_MAP_BOUNDS":
      return { ...state, mapBounds: action.payload };
    case "FIT_MAP_TO_BOUNDS":
      return { ...state, fitBoundsTarget: action.payload };

    // UI actions
    case "SET_UPLOAD_PANEL_VISIBLE":
      return { ...state, isUploadPanelVisible: action.payload };
    case "SET_EDIT_PANEL_VISIBLE":
      return { ...state, isEditPanelVisible: action.payload };
    case "SET_TRAIL_TO_EDIT":
      return { ...state, trailToEdit: action.payload };

    // Drawing actions
    case "START_DRAWING":
      return {
        ...state,
        isDrawingActive: true,
        drawingMode: action.payload,
        isUploadPanelVisible: false,
        isEditPanelVisible: false,
      };
    case "COMPLETE_DRAWING":
      return {
        ...state,
        isDrawingActive: false,
        drawnGpxContent: {
          ...state.drawnGpxContent,
          [action.payload.mode]: action.payload.gpxContent,
        },
      };
    case "CANCEL_DRAWING":
      return {
        ...state,
        isDrawingActive: false,
        drawingMode: null,
      };
    case "CLEAR_DRAWN_CONTENT":
      return {
        ...state,
        drawnGpxContent: {
          ...state.drawnGpxContent,
          [action.payload]: undefined,
        },
      };

    // General actions
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "CLEAR_ERROR":
      return { ...state, error: "" };
    case "INCREMENT_MAP_MOVE_TRIGGER":
      return { ...state, mapMoveEndTrigger: state.mapMoveEndTrigger + 1 };
    case "INCREMENT_MVT_REFRESH_TRIGGER":
      return { ...state, mvtRefreshTrigger: state.mvtRefreshTrigger + 1 };

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
  updateVisibleTrails: (bounds: MapBounds) => void;
  updateVisibleTrailsFromMVT: (trails: MVTTrail[]) => void;
  selectTrail: (trail: MVTTrail | null) => void;
  handleTrailCreated: (newTrail: Trail) => void;
  handleTrailUpdated: (updatedTrail: Trail) => void;
  handleTrailDeleted: (trailId: string) => void;

  // UI methods
  showUploadPanel: () => void;
  hideUploadPanel: () => void;
  showEditPanel: (trail: MVTTrail) => void;
  hideEditPanel: () => void;

  // Drawing methods
  startDrawing: (mode: "upload" | "edit") => void;
  completeDrawing: (gpxContent: string) => void;
  cancelDrawing: () => void;
  clearDrawnContent: (mode: "upload" | "edit") => void;
  getGpxContent: (mode: "upload" | "edit") => string | undefined;
  getPreviousGpxContent: (mode: "upload" | "edit") => string | undefined;

  // General methods
  setError: (error: string) => void;
  clearError: () => void;
  incrementMapMoveTrigger: () => void;
  refreshMVTLayer: () => void;
}

export const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Initialize auth and trails on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize auth
        const currentUser = PocketBaseService.getCurrentUser();
        dispatch({ type: "SET_USER", payload: currentUser });
        dispatch({ type: "SET_AUTH_LOADING", payload: false });

        // Set up auth change listener
        const unsubscribe = PocketBaseService.onAuthChange((newUser) => {
          dispatch({ type: "SET_USER", payload: newUser });
        });

        return unsubscribe;
      } catch (error) {
        console.error("Failed to initialize app:", error);
        dispatch({ type: "SET_ERROR", payload: getErrorMessage(error) });
        dispatch({ type: "SET_AUTH_LOADING", payload: false });
      }
    };

    const cleanup = initializeApp();
    return () => {
      cleanup.then((unsubscribe) => unsubscribe && unsubscribe());
    };
  }, []);

  // Load trail from URL parameter on mount
  useEffect(() => {
    const loadTrailFromUrl = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const trailId = urlParams.get("trail");
      const bboxParam = urlParams.get("bbox");

      if (trailId && state.visibleTrails.length > 0) {
        // Find the trail in visible trails
        const trail = state.visibleTrails.find((t) => t.id === trailId);

        if (trail) {
          // Trail is already loaded in visible trails - just select it, don't pan
          dispatch({ type: "SET_SELECTED_TRAIL", payload: trail });
        } else {
          // Trail not in visible trails yet - try to fetch it from API
          try {
            const fullTrail = await PocketBaseService.getTrail(trailId);

            // Parse bbox if provided
            let bounds = { north: 0, south: 0, east: 0, west: 0 };
            if (bboxParam) {
              const bboxParts = bboxParam.split(",").map(parseFloat);
              if (bboxParts.length === 4 && bboxParts.every((n) => !isNaN(n))) {
                bounds = {
                  west: bboxParts[0],
                  south: bboxParts[1],
                  east: bboxParts[2],
                  north: bboxParts[3],
                };
              }
            }

            // Convert Trail to MVTTrail for compatibility
            const mvtTrail: MVTTrail = {
              id: fullTrail.id,
              name: fullTrail.name,
              description: fullTrail.description,
              level: fullTrail.level,
              tags: fullTrail.tags,
              owner: fullTrail.owner as string,
              created: fullTrail.created,
              updated: fullTrail.updated,
              bounds: bounds, // Use bbox from URL if available
              elevation: { gain: 0, loss: 0, min: 0, max: 0, start: 0, end: 0 },
              distance: 0,
              startPoint: { lat: 0, lng: 0 },
              endPoint: { lat: 0, lng: 0 },
              rating_average: 0,
              rating_count: 0,
              comment_count: 0,
              ridden: fullTrail.ridden,
            };
            dispatch({ type: "SET_SELECTED_TRAIL", payload: mvtTrail });

            // Pan map to bbox if provided
            if (bboxParam && bounds.north !== 0) {
              dispatch({
                type: "FIT_MAP_TO_BOUNDS",
                payload: bounds,
              });
            }
          } catch (error) {
            console.error("Failed to load trail from URL:", error);
            // Clear invalid trail ID from URL
            const url = new URL(window.location.href);
            url.searchParams.delete("trail");
            url.searchParams.delete("bbox");
            window.history.replaceState({}, "", url.toString());
          }
        }
      }
    };

    loadTrailFromUrl();
  }, [state.visibleTrails]);

  // Auth methods
  const login = useCallback(async () => {
    try {
      const user = await PocketBaseService.loginWithGoogle();
      dispatch({ type: "SET_USER", payload: user });
      return user;
    } catch (error) {
      const appError = handleApiError(error);
      dispatch({ type: "SET_ERROR", payload: appError.message });
      throw appError;
    }
  }, []);

  const logout = useCallback(() => {
    PocketBaseService.logout();
    dispatch({ type: "SET_USER", payload: null });
  }, []);

  const updateUser = useCallback((user: User) => {
    dispatch({ type: "SET_USER", payload: user });
  }, []);

  const updateVisibleTrails = useCallback((bounds: MapBounds) => {
    dispatch({ type: "SET_MAP_BOUNDS", payload: bounds });
    // Don't filter here - MVT tiles already contain the right trails for the bounds
  }, []);

  const updateVisibleTrailsFromMVT = useCallback((mvtTrails: MVTTrail[]) => {
    // Optimize: only update if trails actually changed (simple approach)
    dispatch({ type: "SET_VISIBLE_TRAILS", payload: mvtTrails });
  }, []);

  const selectTrail = useCallback((trail: MVTTrail | null) => {
    dispatch({ type: "SET_SELECTED_TRAIL", payload: trail });

    // Update URL with trail parameter and bbox
    if (trail) {
      const url = new URL(window.location.href);
      url.searchParams.set("trail", trail.id);

      // Add bbox if bounds are available
      if (trail.bounds && trail.bounds.north !== 0) {
        const bbox = `${trail.bounds.west},${trail.bounds.south},${trail.bounds.east},${trail.bounds.north}`;
        url.searchParams.set("bbox", bbox);
      }

      window.history.pushState({}, "", url.toString());
    } else {
      // Remove trail and bbox parameters when deselecting
      const url = new URL(window.location.href);
      url.searchParams.delete("trail");
      url.searchParams.delete("bbox");
      window.history.pushState({}, "", url.toString());
    }
  }, []);

  const handleTrailCreated = useCallback((_newTrail: Trail) => {
    // Refresh MVT layer to show new trail
      dispatch({ type: "INCREMENT_MVT_REFRESH_TRIGGER" });
    
  }, []);

  const handleTrailUpdated = useCallback((_updatedTrail: Trail) => {
    // Refresh MVT layer to show updated trail
      dispatch({ type: "INCREMENT_MVT_REFRESH_TRIGGER" });
    
  }, []);

  const handleTrailDeleted = useCallback(
    (trailId: string) => {
      if (state.selectedTrail?.id === trailId) {
        dispatch({ type: "SET_SELECTED_TRAIL", payload: null });
      }

      // Refresh MVT layer to remove deleted trail
        dispatch({ type: "INCREMENT_MVT_REFRESH_TRIGGER" });
    },
    [state.selectedTrail],
  );

  // UI methods
  const showUploadPanel = useCallback(() => {
    dispatch({ type: "SET_UPLOAD_PANEL_VISIBLE", payload: true });
  }, []);

  const hideUploadPanel = useCallback(() => {
    dispatch({ type: "SET_UPLOAD_PANEL_VISIBLE", payload: false });
    dispatch({ type: "CLEAR_DRAWN_CONTENT", payload: "upload" });
  }, []);

  const showEditPanel = useCallback((trail: MVTTrail) => {
    dispatch({ type: "SET_TRAIL_TO_EDIT", payload: trail });
    dispatch({ type: "SET_EDIT_PANEL_VISIBLE", payload: true });
  }, []);

  const hideEditPanel = useCallback(() => {
    dispatch({ type: "SET_EDIT_PANEL_VISIBLE", payload: false });
    dispatch({ type: "SET_TRAIL_TO_EDIT", payload: null });
    dispatch({ type: "CLEAR_DRAWN_CONTENT", payload: "edit" });
  }, []);

  // Drawing methods
  const startDrawing = useCallback((mode: "upload" | "edit") => {
    dispatch({ type: "START_DRAWING", payload: mode });
  }, []);

  const completeDrawing = useCallback(
    (gpxContent: string) => {
      if (state.drawingMode) {
        dispatch({
          type: "COMPLETE_DRAWING",
          payload: { mode: state.drawingMode, gpxContent },
        });
      }
    },
    [state.drawingMode],
  );

  const cancelDrawing = useCallback(() => {
    dispatch({ type: "CANCEL_DRAWING" });
  }, []);

  const clearDrawnContent = useCallback((mode: "upload" | "edit") => {
    dispatch({ type: "CLEAR_DRAWN_CONTENT", payload: mode });
  }, []);

  const getGpxContent = useCallback(
    (mode: "upload" | "edit") => {
      return state.drawnGpxContent[mode];
    },
    [state.drawnGpxContent],
  );

  const getPreviousGpxContent = useCallback(
    (mode: "upload" | "edit") => {
      return state.drawnGpxContent[mode];
    },
    [state.drawnGpxContent],
  );

  // General methods
  const setError = useCallback((error: string) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const incrementMapMoveTrigger = useCallback(() => {
    dispatch({ type: "INCREMENT_MAP_MOVE_TRIGGER" });
  }, []);

  const refreshMVTLayer = useCallback(() => {
    dispatch({ type: "INCREMENT_MVT_REFRESH_TRIGGER" });
  }, []);

  const contextValue: AppContextValue = {
    ...state,
    login,
    logout,
    updateUser,
    updateVisibleTrails,
    updateVisibleTrailsFromMVT,
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
    incrementMapMoveTrigger,
    refreshMVTLayer,
  };

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
};
