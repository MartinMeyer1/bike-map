import React, { useState, useCallback, useRef, useEffect } from 'react';
import L from 'leaflet';
import Map from './components/Map';
import UploadPanel from './components/UploadPanel';
import TrailSidebar from './components/TrailSidebar';
import TrailEditPanel from './components/TrailEditPanel';
import { MobileSheet } from './components/MobileSheet';
import { LocationControls, LocationMarkerRef } from './components/LocationMarker';
import { BaseMapSelector, BaseMapType } from './components/BaseMapSelector';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastStack, Notice, ToastVariant } from './components/ui';
import { AppProvider } from './context/AppContext';
import { useAppContext } from './hooks/useAppContext';
import { useIsMobile } from './hooks/useMediaQuery';
import { useGeolocation } from './hooks/useGeolocation';
import { useDeviceOrientation } from './hooks/useDeviceOrientation';
import './App.css';

/** How long a notice stands before dismissing itself. */
const NOTICE_DURATION_MS = 4000;

const AppContent: React.FC = () => {
  const isMobile = useIsMobile();
  const [showLocationTracking, setShowLocationTracking] = useState(false);
  const [hasRequestedOrientation, setHasRequestedOrientation] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [activeBaseMap, setActiveBaseMap] = useState<BaseMapType>(() => {
    const saved = localStorage.getItem('bikemap-basemap');
    return saved === 'osm' ? 'osm' : 'swisstopo';
  });
  const locationMarkerRef = useRef<LocationMarkerRef>(null);
  const locationRequestPendingRef = useRef(false);
  const mapRef = useRef<L.Map | null>(null);

  // Notices share one stack so a share confirmation and a context error can
  // stand together instead of one covering the other.
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextNoticeId = useRef(1);


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
    clearError
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

  const handleCloseTrail = useCallback(() => {
    selectTrail(null);
  }, [selectTrail]);

  /*
   * The sheet resizes the map's container as it moves, but Leaflet only learns
   * about a container it did not resize itself when told. Once the sheet has
   * settled, re-measure -- and in the detail state, refit the selected trail into
   * whatever strip of map is left above the sheet.
   */
  const handleSheetSettled = useCallback(
    (detent: string) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      map.invalidateSize();

      if (detent === 'detail' && selectedTrail?.bounds) {
        const { south, west, north, east } = selectedTrail.bounds;
        map.fitBounds(L.latLngBounds([south, west], [north, east]), {
          padding: [24, 24],
          maxZoom: 16,
        });
      }
    },
    [selectedTrail],
  );

  const dismissNotice = useCallback((id: number) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const handleShowToast = useCallback((message: string, variant: ToastVariant) => {
    const id = nextNoticeId.current++;
    setNotices((current) => [...current, { id, message, variant }]);
    window.setTimeout(() => dismissNotice(id), NOTICE_DURATION_MS);
  }, [dismissNotice]);

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
      <div className="appBooting">
        <span className="loading"></span>
        Loading BikeMap…
      </div>
    );
  }

  return (
    <div className="App">
      {/*
       * The map's shell is the full viewport on desktop and the space above the
       * sheet on mobile, which App.css derives from the sheet's own height.
       */}
      <div className="mapShell">
        <Map
          selectedTrail={selectedTrail}
          onTrailClick={selectTrail}
          onTrailsLoaded={updateVisibleTrailsFromMVT}
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
          mapRef={mapRef}
          activeBaseMap={activeBaseMap}
        />
      </div>

      {/* Trail sidebar - hidden during drawing mode and on mobile */}
      {!isDrawingActive && !isMobile && (
        <TrailSidebar
          visibleTrails={visibleTrails}
          selectedTrail={selectedTrail}
          user={user}
          onTrailClick={selectTrail}
          onAddTrailClick={showUploadPanel}
          onEditTrailClick={showEditPanel}
        />
      )}

      {/*
       * On mobile everything the sidebar holds lives in the sheet instead: the
       * trail strip, the account block, the legend, and the selected trail. There
       * is no top banner, so the map keeps the whole screen above it.
       */}
      {isMobile && !isDrawingActive && (
        <MobileSheet
          trails={visibleTrails}
          selectedTrail={selectedTrail}
          user={user}
          onOpenTrail={selectTrail}
          onCloseTrail={handleCloseTrail}
          onAddTrailClick={showUploadPanel}
          onEditTrailClick={showEditPanel}
          onShowToast={handleShowToast}
          onSettled={handleSheetSettled}
        />
      )}

      {/*
       * One stack for everything: notices raised by a component (sharing,
       * routing fallbacks) and the context error, which used to be its own
       * fixed banner in a different visual language.
       */}
      <ToastStack
        notices={error ? [...notices, { id: 0, message: error, variant: 'error' }] : notices}
        onDismiss={(id) => (id === 0 ? clearError() : dismissNotice(id))}
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