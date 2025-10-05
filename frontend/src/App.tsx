import React, { useState, useCallback, useRef } from 'react';
import Map from './components/Map';
import UploadPanel from './components/UploadPanel';
import TrailSidebar from './components/TrailSidebar';
import TrailEditPanel from './components/TrailEditPanel';
import { MobileTrailPopup } from './components/MobileTrailPopup';
import { MobileHeader } from './components/MobileHeader';
import { LocationControls, LocationMarkerRef } from './components/LocationMarker';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toast } from './components/ui';
import { AppProvider } from './context/AppContext';
import { useAppContext } from './hooks/useAppContext';
import { useIsMobile } from './hooks/useMediaQuery';
import { useGeolocation } from './hooks/useGeolocation';
import { useDeviceOrientation } from './hooks/useDeviceOrientation';
import { Trail, MVTTrail } from './types';
import './App.css';

const AppContent: React.FC = () => {
  const isMobile = useIsMobile();
  const [mobileSelectedTrail, setMobileSelectedTrail] = useState<MVTTrail | null>(null);
  const [showLocationTracking, setShowLocationTracking] = useState(false);
  const [hasRequestedOrientation, setHasRequestedOrientation] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const locationMarkerRef = useRef<LocationMarkerRef>(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastVariant, setToastVariant] = useState<'success' | 'error'>('success');
  const [showToast, setShowToast] = useState(false);
  
  // Location services for all devices
  const {
    position: userLocation,
    error: locationError,
    startWatching: startLocationTracking,
    stopWatching: stopLocationTracking
  } = useGeolocation({
    enableHighAccuracy: true,
    watch: showLocationTracking,
    watchInterval: 2000
  });
  
  // Device orientation for compass
  const {
    orientation,
    permission: orientationPermission,
    requestPermission: requestOrientationPermission
  } = useDeviceOrientation();

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

  // Sync selectedTrail to mobileSelectedTrail when trail is loaded from URL
  React.useEffect(() => {
    if (isMobile && selectedTrail && !mobileSelectedTrail) {
      // Trail was selected (likely from URL) but mobile popup isn't showing
      setMobileSelectedTrail(selectedTrail);
    }
  }, [isMobile, selectedTrail, mobileSelectedTrail]);

  // Handle map movement end
  const handleMapMoveEnd = React.useCallback(() => {
    incrementMapMoveTrigger();
  }, [incrementMapMoveTrigger]);

  // Mobile-specific handlers
  const handleMobileTrailClick = useCallback((trail: MVTTrail | null) => {
    if (isMobile) {
      setMobileSelectedTrail(trail);
      if (trail) {
        selectTrail(trail);
      }
    } else {
      selectTrail(trail);
    }
  }, [isMobile, selectTrail]);

  const handleCloseMobilePopup = useCallback(() => {
    setMobileSelectedTrail(null);
    selectTrail(null);
  }, [selectTrail]);

  // Toast handler
  const handleShowToast = useCallback((message: string, variant: 'success' | 'error') => {
    setToastMessage(message);
    setToastVariant(variant);
    setShowToast(true);
  }, []);

  const handleLocationRequest = useCallback(async () => {
    setIsLocationLoading(true);
    
    if (!showLocationTracking) {
      setShowLocationTracking(true);
      startLocationTracking();
      
      // Request orientation permission on first location request (mainly for mobile devices)
      if (!hasRequestedOrientation && orientationPermission.prompt) {
        try {
          await requestOrientationPermission();
          setHasRequestedOrientation(true);
        } catch (error) {
          console.warn('Orientation permission denied:', error);
        }
      }
    }
    
    // Loading will be cleared when location is received or error occurs
    setTimeout(() => setIsLocationLoading(false), 5000); // Fallback timeout
  }, [showLocationTracking, startLocationTracking, hasRequestedOrientation, orientationPermission.prompt, requestOrientationPermission]);

  const handleToggleLocationTracking = useCallback(() => {
    if (showLocationTracking) {
      setShowLocationTracking(false);
      stopLocationTracking();
    } else {
      handleLocationRequest();
    }
  }, [showLocationTracking, stopLocationTracking, handleLocationRequest]);

  const handleZoomToLocation = useCallback(() => {
    if (locationMarkerRef.current && userLocation) {
      locationMarkerRef.current.centerOnLocation(16); // Zoom level 16 for good detail
    }
  }, [userLocation]);

  // Calculate user heading from device orientation
  const userHeading = orientation?.compass;

  // Clear loading state and auto-zoom when location is first received
  React.useEffect(() => {
    if (userLocation || locationError) {
      setIsLocationLoading(false);
    }
    
    // Auto-zoom to location when first received (if it was requested by user)
    if (userLocation && isLocationLoading && locationMarkerRef.current) {
      locationMarkerRef.current.centerOnLocation(16);
    }
  }, [userLocation, locationError, isLocationLoading]);

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
    <div className={`App ${isMobile ? 'mobile-app' : ''}`}>
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

      {/* Mobile Header - only shown on mobile */}
      {isMobile && !isDrawingActive && (
        <MobileHeader
          user={user}
          onAddTrailClick={showUploadPanel}
        />
      )}

      {/* Main map */}
      <Map 
        selectedTrail={selectedTrail}
        onBoundsChange={updateVisibleTrails}
        onTrailClick={isMobile ? handleMobileTrailClick : selectTrail}
        onTrailsLoaded={updateVisibleTrailsFromMVT}
        onMapMoveEnd={handleMapMoveEnd}
        refreshTrigger={mvtRefreshTrigger}
        isDrawingActive={isDrawingActive}
        onRouteComplete={drawingMode === 'edit' ? handleEditRouteComplete : handleRouteComplete}
        onDrawingCancel={drawingMode === 'edit' ? handleEditDrawingCancel : handleDrawingCancel}
        initialGpxContent={getPreviousGpxContent(drawingMode || 'upload')}
        userLocation={userLocation}
        showUserLocation={!!userLocation}
        userHeading={userHeading}
        locationMarkerRef={locationMarkerRef}
      />

      {/* Trail sidebar - hidden during drawing mode and on mobile */}
      {!isDrawingActive && !isMobile && (
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

      {/* Mobile trail popup */}
      {isMobile && mobileSelectedTrail && (
        <MobileTrailPopup
          trail={mobileSelectedTrail}
          user={user}
          onClose={handleCloseMobilePopup}
          onEditTrailClick={(trail) => {
            showEditPanel(trail);
            handleCloseMobilePopup();
          }}
          onShowToast={handleShowToast}
        />
      )}

      {/* Toast notification */}
      <Toast
        message={toastMessage}
        variant={toastVariant}
        show={showToast}
        onClose={() => setShowToast(false)}
      />

      {/* Location controls - available on all devices */}
      {!isDrawingActive && (
        <LocationControls
          onLocationRequest={handleLocationRequest}
          onToggleTracking={handleToggleLocationTracking}
          onZoomToLocation={handleZoomToLocation}
          isTracking={showLocationTracking}
          hasLocation={!!userLocation}
          isLoading={isLocationLoading}
          locationError={locationError?.message}
        />
      )}

      {/* Upload panel */}
      <UploadPanel
        isVisible={isUploadPanelVisible}
        onClose={hideUploadPanel}
        onTrailCreated={(newTrail) => {
          handleTrailCreatedComplete(newTrail);
          if (isMobile) {
            setMobileSelectedTrail(null);
          }
        }}
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