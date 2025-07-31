import React from 'react';
import Map from './components/Map';
import UploadPanel from './components/UploadPanel';
import TrailSidebar from './components/TrailSidebar';
import TrailEditPanel from './components/TrailEditPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider } from './context/AppContext';
import { useAuth, useTrails, useDrawing } from './hooks';
import { User, Trail } from './types';
import { CachedTrail } from './services/trailCache';
import './App.css';

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const {
    trails,
    visibleTrails,
    selectedTrail,
    mapBounds,
    isLoading,
    error,
    selectTrail,
    updateVisibleTrails,
    handleTrailCreated,
    handleTrailUpdated,
    handleTrailDeleted,
    clearError
  } = useTrails();

  const {
    isDrawingActive,
    drawingMode,
    startDrawing,
    completeDrawing,
    cancelDrawing,
    clearDrawnContent,
    getGpxContent,
    getPreviousGpxContent
  } = useDrawing();

  const [isUploadPanelVisible, setIsUploadPanelVisible] = React.useState(false);
  const [isEditPanelVisible, setIsEditPanelVisible] = React.useState(false);
  const [trailToEdit, setTrailToEdit] = React.useState<CachedTrail | null>(null);
  const [mapMoveEndTrigger, setMapMoveEndTrigger] = React.useState(0);

  // Handle authentication changes
  const handleAuthChange = (_newUser: User | null) => {
    // Auth is handled by the useAuth hook automatically
  };

  // Handle trail creation
  const handleTrailCreatedComplete = async (newTrail: Trail) => {
    await handleTrailCreated(newTrail);
    setIsUploadPanelVisible(false);
    clearDrawnContent('upload');
  };

  // Handle trail update
  const handleTrailUpdatedComplete = async (updatedTrail: Trail) => {
    await handleTrailUpdated(updatedTrail);
    setIsEditPanelVisible(false);
    setTrailToEdit(null);
    clearDrawnContent('edit');
  };

  // Handle trail deletion
  const handleTrailDeletedComplete = (trailId: string) => {
    handleTrailDeleted(trailId);
    setIsEditPanelVisible(false);
    setTrailToEdit(null);
  };

  // Handle edit trail click
  const handleEditTrailClick = (trail: CachedTrail) => {
    setTrailToEdit(trail);
    setIsEditPanelVisible(true);
  };

  // Handle start drawing
  const handleStartDrawing = () => {
    startDrawing('upload');
    setIsUploadPanelVisible(false);
  };

  // Handle route drawing completed
  const handleRouteComplete = (gpxContent: string) => {
    completeDrawing(gpxContent);
    setIsUploadPanelVisible(true);
  };

  // Handle drawing cancelled
  const handleDrawingCancel = () => {
    cancelDrawing();
    setIsUploadPanelVisible(true);
  };

  // Handle start drawing for edit panel
  const handleEditStartDrawing = () => {
    startDrawing('edit');
    setIsEditPanelVisible(false);
  };

  // Handle route drawing completed for edit panel
  const handleEditRouteComplete = (gpxContent: string) => {
    completeDrawing(gpxContent);
    setIsEditPanelVisible(true);
  };

  // Handle drawing cancelled for edit panel
  const handleEditDrawingCancel = () => {
    cancelDrawing();
    setIsEditPanelVisible(true);
  };

  // Handle map movement end
  const handleMapMoveEnd = React.useCallback(() => {
    setMapMoveEndTrigger(prev => prev + 1);
  }, []);

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        color: '#666'
      }}>
        <span className="loading" style={{ marginRight: '12px' }}></span>
        Loading BikeMap...
      </div>
    );
  }

  return (
    <div className="App">
      {error && (
        <div style={{
          position: 'fixed',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000,
          background: '#f8d7da',
          color: '#721c24',
          padding: '10px 20px',
          borderRadius: '4px',
          border: '1px solid #f5c6cb'
        }}>
          {error}
          <button 
            onClick={clearError}
            style={{ 
              marginLeft: '10px', 
              background: 'none', 
              border: 'none', 
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main map */}
      <Map 
        trails={isDrawingActive ? [] : trails}
        selectedTrail={selectedTrail}
        onBoundsChange={updateVisibleTrails}
        onTrailClick={selectTrail}
        onMapMoveEnd={handleMapMoveEnd}
        isDrawingActive={isDrawingActive}
        onRouteComplete={drawingMode === 'edit' ? handleEditRouteComplete : handleRouteComplete}
        onDrawingCancel={drawingMode === 'edit' ? handleEditDrawingCancel : handleDrawingCancel}
        initialGpxContent={getPreviousGpxContent(drawingMode || 'upload')}
      />

      {/* Trail sidebar - hidden during drawing mode */}
      {!isDrawingActive && (
        <TrailSidebar
          trails={trails}
          visibleTrails={visibleTrails}
          selectedTrail={selectedTrail}
          mapBounds={mapBounds}
          mapMoveEndTrigger={mapMoveEndTrigger}
          user={user}
          onTrailClick={selectTrail}
          onAddTrailClick={() => setIsUploadPanelVisible(true)}
          onAuthChange={handleAuthChange}
          onEditTrailClick={handleEditTrailClick}
        />
      )}

      {/* Upload panel */}
      <UploadPanel
        isVisible={isUploadPanelVisible}
        onClose={() => {
          setIsUploadPanelVisible(false);
          clearDrawnContent('upload');
        }}
        onTrailCreated={handleTrailCreatedComplete}
        onStartDrawing={handleStartDrawing}
        drawnGpxContent={getGpxContent('upload')}
      />

      {/* Edit panel */}
      <TrailEditPanel
        isVisible={isEditPanelVisible}
        trail={trailToEdit}
        onClose={() => {
          setIsEditPanelVisible(false);
          setTrailToEdit(null);
          clearDrawnContent('edit');
        }}
        onTrailUpdated={handleTrailUpdatedComplete}
        onTrailDeleted={handleTrailDeletedComplete}
        onStartDrawing={handleEditStartDrawing}
        drawnGpxContent={getGpxContent('edit')}
      />
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;