import React, { useState, useCallback, useRef, useEffect } from 'react';
import Map from './components/Map';
import UploadPanel from './components/UploadPanel';
import TrailSidebar from './components/TrailSidebar';
import TrailEditPanel from './components/TrailEditPanel';
import { MobileTrailPopup } from './components/MobileTrailPopup';
import { MobileHeader } from './components/MobileHeader';
import { LocationControls, LocationMarkerRef } from './components/LocationMarker';
import { BaseMapSelector, BaseMapType } from './components/BaseMapSelector';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toast } from './components/ui';
import { AppProvider } from './context/AppContext';
import { useAppContext } from './hooks/useAppContext';
import { useIsMobile } from './hooks/useMediaQuery';
import { useGeolocation } from './hooks/useGeolocation';
import { useDeviceOrientation } from './hooks/useDeviceOrientation';
import { MVTTrail } from './types';
import './App.css';

const AppContent: React.FC = () => {
  const isMobile = useIsMobile();
  const [mobileSelectedTrail, setMobileSelectedTrail] = useState<MVTTrail | null>(null);
  const [showLocationTracking, setShowLocationTracking] = useState(false);
  const [hasRequestedOrientation, setHasRequestedOrientation] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [activeBaseMap, setActiveBaseMap] = useState<BaseMapType>(() => {
    const saved = localStorage.getItem('bikemap-basemap');
    return saved === 'osm' ? 'osm' : 'swisstopo';
  });
  const locationMarkerRef = useRef<LocationMarkerRef>(null);
  const locationRequestPendingRef = useRef(false);

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
    user,
    isAuthLoading,

    visibleTrails,
    selectedTrail,
    fitBoundsTarget,

    isUploadPanelVisible,
    isEditPanelVisible,
    trailToEdit,

    isDrawingActive,
    drawingMode,

    error,
    mapMoveEndTrigger,
    mvtRefreshTrigger,
    
    updateVisibleTrailsFromMVT,
    selectTrail,
    handleTrailDeleted,
    refreshMVTLayer,
    showUploadPanel,
    hideUploadPanel,
    showEditPanel,
    hideEditPanel,
    startDrawing,
    completeDrawing,
    cancelDrawing,
    getGpxContent,
    clearError,
    incrementMapMoveTrigger
  } = useAppContext();

  const handleStartDrawing = () => {
    startDrawing('upload');
  };

  const handleRouteComplete = (gpxContent: string) => {
    completeDrawing(gpxContent);
    showUploadPanel();
  };

  const handleDrawingCancel = () => {
    cancelDrawing();
    showUploadPanel();
  };

  const handleEditStartDrawing = () => {
    startDrawing('edit');
  };

  const handleEditRouteComplete = (gpxContent: string) => {
    completeDrawing(gpxContent);
    showEditPanel(trailToEdit!);
  };

  const handleEditDrawingCancel = () => {
    cancelDrawing();
    showEditPanel(trailToEdit!);
  };

  // Sync selectedTrail to mobileSelectedTrail when trail is loaded from URL.
  // Adjusted during render (not in an effect) per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (isMobile && selectedTrail && !mobileSelectedTrail) {
    // Trail was selected (likely from URL) but mobile popup isn't showing
    setMobileSelectedTrail(selectedTrail);
  }

  const handleMapMoveEnd = useCallback(() => {
    incrementMapMoveTrigger();
  }, [incrementMapMoveTrigger]);

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

  const handleShowToast = useCallback((message: string, variant: 'success' | 'error') => {
    setToastMessage(message);
    setToastVariant(variant);
    setShowToast(true);
  }, []);

  const handleToggleBaseMap = useCallback(() => {
    setActiveBaseMap(prev => {
      const next = prev === 'swisstopo' ? 'osm' : 'swisstopo';
      localStorage.setItem('bikemap-basemap', next);
      return next;
    });
  }, []);

  const handleLocationRequest = useCallback(async () => {
    setIsLocationLoading(true);
    locationRequestPendingRef.current = true;

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

  // Clear loading state once a location or error comes back.
  // Adjusted during render (not in an effect) per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if ((userLocation || locationError) && isLocationLoading) {
    setIsLocationLoading(false);
  }

  // Auto-zoom to location when first received after an explicit user request.
  // This is a real imperative side effect (calling a ref method), so it stays
  // in an effect; locationRequestPendingRef (not isLocationLoading) tracks
  // whether we're still owed a zoom, since isLocationLoading may already have
  // been cleared above by the time this effect runs.
  useEffect(() => {
    if (userLocation && locationRequestPendingRef.current && locationMarkerRef.current) {
      locationRequestPendingRef.current = false;
      locationMarkerRef.current.centerOnLocation(16);
    }
  }, [userLocation]);

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
        onTrailClick={isMobile ? handleMobileTrailClick : selectTrail}
        onTrailsLoaded={updateVisibleTrailsFromMVT}
        onMapMoveEnd={handleMapMoveEnd}
        refreshTrigger={mvtRefreshTrigger}
        fitBoundsTarget={fitBoundsTarget}
        isDrawingActive={isDrawingActive}
        onRouteComplete={drawingMode === 'edit' ? handleEditRouteComplete : handleRouteComplete}
        onDrawingCancel={drawingMode === 'edit' ? handleEditDrawingCancel : handleDrawingCancel}
        initialGpxContent={getGpxContent(drawingMode || 'upload')}
        userLocation={userLocation}
        showUserLocation={!!userLocation}
        userHeading={userHeading}
        locationMarkerRef={locationMarkerRef}
        activeBaseMap={activeBaseMap}
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

      {/* Location controls and base map selector - available on all devices */}
      {!isDrawingActive && (
        <>
          <LocationControls
            onLocationRequest={handleLocationRequest}
            onToggleTracking={handleToggleLocationTracking}
            onZoomToLocation={handleZoomToLocation}
            isTracking={showLocationTracking}
            hasLocation={!!userLocation}
            isLoading={isLocationLoading}
            locationError={locationError?.message}
          />
          <BaseMapSelector
            activeBaseMap={activeBaseMap}
            onToggle={handleToggleBaseMap}
          />
        </>
      )}

      {/* Upload panel */}
      <UploadPanel
        isVisible={isUploadPanelVisible}
        onClose={hideUploadPanel}
        onTrailCreated={() => {
          // The panel closes itself through onClose; this only refreshes the map.
          refreshMVTLayer();
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
        onTrailUpdated={refreshMVTLayer}
        onTrailDeleted={handleTrailDeleted}
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