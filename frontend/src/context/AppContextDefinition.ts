import { createContext } from "react";
import { User, MapBounds, MVTTrail } from "../types";

export interface AppState {
  // Auth state
  user: User | null;
  isAuthLoading: boolean;

  // Trail state
  visibleTrails: MVTTrail[]; // From MVT layer - only currently visible tiles
  selectedTrail: MVTTrail | null;
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

export interface AppContextValue extends AppState {
  // Auth methods
  login: () => Promise<User | null>;
  logout: () => void;
  updateUser: (user: User) => void;

  // Trail methods
  updateVisibleTrailsFromMVT: (trails: MVTTrail[]) => void;
  selectTrail: (trail: MVTTrail | null) => void;
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
  getGpxContent: (mode: "upload" | "edit") => string | undefined;

  // General methods
  setError: (error: string) => void;
  clearError: () => void;
  incrementMapMoveTrigger: () => void;
  refreshMVTLayer: () => void;
}

// Kept apart from AppProvider so that the provider module exports only
// components, which is what react-refresh needs to hot-reload it.
export const AppContext = createContext<AppContextValue | undefined>(undefined);
