import React, { useReducer, useCallback, useEffect, useMemo, useRef } from "react";
import { User, MapBounds, MVTTrail } from "../types";
import { PocketBaseService } from "../services/pocketbase";
import { handleApiError, getErrorMessage } from "../utils/errorHandling";
import { AppContext, AppContextValue, AppState } from "./AppContextDefinition";

type AppAction =
  | { type: "SET_USER"; payload: User | null }
  | { type: "SET_AUTH_LOADING"; payload: boolean }

  | { type: "SET_VISIBLE_TRAILS"; payload: MVTTrail[] }
  | { type: "SELECT_TRAIL"; payload: MVTTrail | null }
  | { type: "SYNC_SELECTED_TRAIL"; payload: MVTTrail }
  | { type: "FIT_MAP_TO_BOUNDS"; payload: MapBounds | null }

  | { type: "SET_UPLOAD_PANEL_VISIBLE"; payload: boolean }
  | { type: "SET_EDIT_PANEL_VISIBLE"; payload: boolean }
  | { type: "SET_TRAIL_TO_EDIT"; payload: MVTTrail | null }

  | { type: "START_DRAWING"; payload: "upload" | "edit" }
  | {
      type: "COMPLETE_DRAWING";
      payload: { mode: "upload" | "edit"; gpxContent: string };
    }
  | { type: "CANCEL_DRAWING" }
  | { type: "CLEAR_DRAWN_CONTENT"; payload: "upload" | "edit" }

  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" }
  | { type: "INCREMENT_MVT_REFRESH_TRIGGER" };

const initialState: AppState = {
  user: null,
  isAuthLoading: true,

  visibleTrails: [],
  selectedTrail: null,
  fitBoundsTarget: null,
  trailFocusRequest: 0,

  isUploadPanelVisible: false,
  isEditPanelVisible: false,
  trailToEdit: null,

  isDrawingActive: false,
  drawingMode: null,
  drawnGpxContent: {},

  error: "",
  mvtRefreshTrigger: 0,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
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
    case "SELECT_TRAIL":
      // A deliberate selection, and the only thing that asks the map to frame
      // one. Deselecting does not: there is nothing to fly to.
      return {
        ...state,
        selectedTrail: action.payload,
        trailFocusRequest: action.payload
          ? state.trailFocusRequest + 1
          : state.trailFocusRequest,
      };
    case "SYNC_SELECTED_TRAIL":
      // The same trail, with a fuller record than the one already held. Leaves
      // the focus counter alone, so the camera stays where the reader put it.
      return state.selectedTrail?.id === action.payload.id
        ? { ...state, selectedTrail: action.payload }
        : state;
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
    case "INCREMENT_MVT_REFRESH_TRIGGER":
      return { ...state, mvtRefreshTrigger: state.mvtRefreshTrigger + 1 };

    default:
      return state;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Initialize auth on mount
  useEffect(() => {
    try {
      dispatch({ type: "SET_USER", payload: PocketBaseService.getCurrentUser() });
      dispatch({ type: "SET_AUTH_LOADING", payload: false });

      return PocketBaseService.onAuthChange((newUser) => {
        dispatch({ type: "SET_USER", payload: newUser });
      });
    } catch (error) {
      console.error("Failed to initialize app:", error);
      dispatch({ type: "SET_ERROR", payload: getErrorMessage(error) });
      dispatch({ type: "SET_AUTH_LOADING", payload: false });
    }
  }, []);

  /*
   * A trail carried in the URL, restored once the first tiles have arrived --
   * and only ever once.
   *
   * This used to re-run on every change to visibleTrails, which is to say on
   * every pan: it re-read the `?trail=` that selectTrail itself had written,
   * re-selected the same trail as a brand-new object, and fetched it again from
   * the API whenever the pan had carried it off screen. The map, which framed
   * the selection whenever that object changed, dutifully flew back to it. The
   * one thing that genuinely wanted a second pass is handled below instead.
   */
  const urlRestoreRef = useRef(false);
  /** The trail whose stub record is still waiting for its tiles -- see below. */
  const enrichIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (urlRestoreRef.current) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const trailId = urlParams.get("trail");
    const bboxParam = urlParams.get("bbox");

    if (!trailId) {
      urlRestoreRef.current = true;
      return;
    }

    // No tiles yet, so nothing to look the trail up in: try again on the next
    // idle rather than paying for the API when the answer may be on screen.
    if (state.visibleTrails.length === 0) {
      return;
    }

    // Claimed before the await, so a second render -- or StrictMode's second
    // mount -- cannot start the same restore again.
    urlRestoreRef.current = true;

    const trail = state.visibleTrails.find((t) => t.id === trailId);

    if (trail) {
      // Already on screen, with its full tile record: select it where it is.
      dispatch({ type: "SELECT_TRAIL", payload: trail });
      return;
    }

    const restoreFromApi = async () => {
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

        // Convert Trail to MVTTrail for compatibility. The figures the tiles
        // carry -- distance, elevation, ratings -- are not in this record, so
        // it stands in until the tiles covering the trail load.
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

        enrichIdRef.current = trailId;
        dispatch({ type: "SELECT_TRAIL", payload: mvtTrail });

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
    };

    restoreFromApi();
  }, [state.visibleTrails]);

  /*
   * The stub above, upgraded the moment the trail's own tiles arrive -- the
   * detail panel reads distance, elevation and ratings, none of which the API
   * record carries. Syncing rather than selecting, so the camera is left alone;
   * and once, because the ref is cleared on the way through.
   */
  useEffect(() => {
    const trailId = enrichIdRef.current;

    if (!trailId) {
      return;
    }

    const full = state.visibleTrails.find((t) => t.id === trailId);

    if (!full) {
      return;
    }

    enrichIdRef.current = null;
    dispatch({ type: "SYNC_SELECTED_TRAIL", payload: full });
  }, [state.visibleTrails]);

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

  const updateVisibleTrailsFromMVT = useCallback((mvtTrails: MVTTrail[]) => {
    dispatch({ type: "SET_VISIBLE_TRAILS", payload: mvtTrails });
  }, []);

  const selectTrail = useCallback((trail: MVTTrail | null) => {
    dispatch({ type: "SELECT_TRAIL", payload: trail });

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

  const handleTrailDeleted = useCallback(
    (trailId: string) => {
      if (state.selectedTrail?.id === trailId) {
        dispatch({ type: "SELECT_TRAIL", payload: null });
      }

      dispatch({ type: "INCREMENT_MVT_REFRESH_TRIGGER" });
    },
    [state.selectedTrail],
  );

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

  const getGpxContent = useCallback(
    (mode: "upload" | "edit") => {
      return state.drawnGpxContent[mode];
    },
    [state.drawnGpxContent],
  );

  const setError = useCallback((error: string) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const refreshMVTLayer = useCallback(() => {
    dispatch({ type: "INCREMENT_MVT_REFRESH_TRIGGER" });
  }, []);

  const contextValue: AppContextValue = useMemo(
    () => ({
      ...state,
      login,
      logout,
      updateUser,
      updateVisibleTrailsFromMVT,
      selectTrail,
      handleTrailDeleted,
      showUploadPanel,
      hideUploadPanel,
      showEditPanel,
      hideEditPanel,
      startDrawing,
      completeDrawing,
      cancelDrawing,
      getGpxContent,
      setError,
      clearError,
      refreshMVTLayer,
    }),
    [
      state,
      login,
      logout,
      updateUser,
      updateVisibleTrailsFromMVT,
      selectTrail,
      handleTrailDeleted,
      showUploadPanel,
      hideUploadPanel,
      showEditPanel,
      hideEditPanel,
      startDrawing,
      completeDrawing,
      cancelDrawing,
      getGpxContent,
      setError,
      clearError,
      refreshMVTLayer,
    ],
  );

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
};
