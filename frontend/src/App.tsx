import React from 'react';
import Map from './components/Map';
import UploadPanel from './components/UploadPanel';
import TrailSidebar from './components/TrailSidebar';
import TrailEditPanel from './components/TrailEditPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider } from './context/AppContext';
import { useAppContext } from './hooks/useAppContext';
import { Trail } from './types';
import './App.css';

const AppContent: React.FC = () => {
  const {
    // Auth state
    user,
    isAuthLoading,
    
    // Trail state
    visibleTrails,
    selectedTrail,
    
    // UI state
    isUploadPanelVisible,
    isEditPanelVisible,
    trailToEdit,
    
    // Drawing state
    isDrawingActive,
    drawingMode,
    
    // General state
    error,
    mapMoveEndTrigger,
    mvtRefreshTrigger,
    
    // Methods
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
    getGpxContent,
    getPreviousGpxContent,
    clearError,
    incrementMapMoveTrigger
  } = useAppContext();

  // Handle trail creation
  const handleTrailCreatedComplete = async (newTrail: Trail) => {
    await handleTrailCreated(newTrail);
    hideUploadPanel();
  };

  // Handle trail update
  const handleTrailUpdatedComplete = async (updatedTrail: Trail) => {
    await handleTrailUpdated(updatedTrail);
    hideEditPanel();
  };

  // Handle trail deletion
  const handleTrailDeletedComplete = (trailId: string) => {
    handleTrailDeleted(trailId);
    hideEditPanel();
  };

  // Handle start drawing
  const handleStartDrawing = () => {
    startDrawing('upload');
  };

  // Handle route drawing completed
  const handleRouteComplete = (gpxContent: string) => {
    completeDrawing(gpxContent);
    showUploadPanel();
  };

  // Handle drawing cancelled
  const handleDrawingCancel = () => {
    cancelDrawing();
    showUploadPanel();
  };

  // Handle start drawing for edit panel
  const handleEditStartDrawing = () => {
    startDrawing('edit');
  };

  // Handle route drawing completed for edit panel
  const handleEditRouteComplete = (gpxContent: string) => {
    completeDrawing(gpxContent);
    showEditPanel(trailToEdit!);
  };

  // Handle drawing cancelled for edit panel
  const handleEditDrawingCancel = () => {
    cancelDrawing();
    showEditPanel(trailToEdit!);
  };

  // Handle map movement end
  const handleMapMoveEnd = React.useCallback(() => {
    incrementMapMoveTrigger();
  }, [incrementMapMoveTrigger]);

  if (isAuthLoading) {
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
        selectedTrail={selectedTrail}
        onBoundsChange={updateVisibleTrails}
        onTrailClick={selectTrail}
        onTrailsLoaded={updateVisibleTrailsFromMVT}
        onMapMoveEnd={handleMapMoveEnd}
        refreshTrigger={mvtRefreshTrigger}
        isDrawingActive={isDrawingActive}
        onRouteComplete={drawingMode === 'edit' ? handleEditRouteComplete : handleRouteComplete}
        onDrawingCancel={drawingMode === 'edit' ? handleEditDrawingCancel : handleDrawingCancel}
        initialGpxContent={getPreviousGpxContent(drawingMode || 'upload')}
      />

      {/* Trail sidebar - hidden during drawing mode */}
      {!isDrawingActive && (
        <TrailSidebar
          visibleTrails={visibleTrails}
          selectedTrail={selectedTrail}
          mapMoveEndTrigger={mapMoveEndTrigger}
          user={user}
          onTrailClick={selectTrail}
          onAddTrailClick={showUploadPanel}
          onEditTrailClick={showEditPanel}
        />
      )}

      {/* Upload panel */}
      <UploadPanel
        isVisible={isUploadPanelVisible}
        onClose={hideUploadPanel}
        onTrailCreated={handleTrailCreatedComplete}
        onStartDrawing={handleStartDrawing}
        drawnGpxContent={getGpxContent('upload')}
      />

      {/* Edit panel */}
      <TrailEditPanel
        isVisible={isEditPanelVisible}
        trail={trailToEdit}
        onClose={hideEditPanel}
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