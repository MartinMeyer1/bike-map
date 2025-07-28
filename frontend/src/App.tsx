import React, { useState, useEffect, useCallback } from 'react';
import Map from './components/Map';
import UploadPanel from './components/UploadPanel';
import TrailSidebar from './components/TrailSidebar';
import TrailEditPanel from './components/TrailEditPanel';
import { Trail, User, MapBounds } from './types';
import { PocketBaseService } from './services/pocketbase';
import trailCache, { CachedTrail } from './services/trailCache';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [trails, setTrails] = useState<CachedTrail[]>([]);
  const [visibleTrails, setVisibleTrails] = useState<CachedTrail[]>([]);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [isUploadPanelVisible, setIsUploadPanelVisible] = useState(false);
  const [isEditPanelVisible, setIsEditPanelVisible] = useState(false);
  const [trailToEdit, setTrailToEdit] = useState<CachedTrail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTrail, setSelectedTrail] = useState<CachedTrail | null>(null);

  // Initialize app - check auth and initialize trail cache
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check if user is already authenticated
        const currentUser = PocketBaseService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }

        // Initialize trail cache (loads and processes all trails)
        await trailCache.initialize();
        
        // Load cached trails into state
        const cachedTrails = trailCache.getAllTrails();
        setTrails(cachedTrails);
        setVisibleTrails(cachedTrails); // Initially show all trails
      } catch (err: any) {
        console.error('Failed to initialize app:', err);
        setError('Failed to load application data');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Refresh trails from cache (used after uploads)
  const refreshTrails = useCallback(() => {
    const cachedTrails = trailCache.getAllTrails();
    setTrails(cachedTrails);
    
    // Update visible trails based on current bounds
    if (mapBounds) {
      const boundsFiltered = trailCache.getTrailsInBounds(mapBounds);
      setVisibleTrails(boundsFiltered);
    } else {
      setVisibleTrails(cachedTrails);
    }
  }, [mapBounds]);

  // Update visible trails when map bounds change
  const updateVisibleTrails = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
    
    // Use cached spatial filtering for better performance
    const boundsFiltered = trailCache.getTrailsInBounds(bounds);
    setVisibleTrails(boundsFiltered);
  }, []);

  // Handle authentication changes
  const handleAuthChange = (newUser: User | null) => {
    setUser(newUser);
  };

  // Handle trail creation
  const handleTrailCreated = async (newTrail: Trail) => {
    try {
      // Add trail to cache (will process GPX automatically)
      await trailCache.addTrail(newTrail);
      
      // Refresh trails from cache after a short delay to allow backend processing
      setTimeout(() => {
        refreshTrails();
      }, 1000);
    } catch (error) {
      console.error('Failed to add trail to cache:', error);
      setError('Failed to process uploaded trail');
    }
  };

  // Handle trail update
  const handleTrailUpdated = async (updatedTrail: Trail) => {
    try {
      // Update trail in cache
      await trailCache.updateTrail(updatedTrail);
      
      // Refresh trails from cache after a short delay to allow backend processing
      // (especially important if GPX file was updated)
      setTimeout(() => {
        refreshTrails();
      }, 1000);
    } catch (error) {
      console.error('Failed to update trail in cache:', error);
      setError('Failed to update trail');
    }
  };

  // Handle trail deletion
  const handleTrailDeleted = (trailId: string) => {
    try {
      // Remove trail from cache
      trailCache.removeTrail(trailId);
      
      // Clear selection if deleted trail was selected
      if (selectedTrail?.id === trailId) {
        setSelectedTrail(null);
      }
      
      // Refresh trails from cache
      refreshTrails();
      
      // Close edit panel
      setIsEditPanelVisible(false);
      setTrailToEdit(null);
    } catch (error) {
      console.error('Failed to remove trail from cache:', error);
      setError('Failed to remove trail');
    }
  };

  // Handle edit trail click
  const handleEditTrailClick = (trail: CachedTrail) => {
    setTrailToEdit(trail);
    setIsEditPanelVisible(true);
  };

  // Handle trail updated
  const handleTrailUpdatedComplete = (updatedTrail: Trail) => {
    handleTrailUpdated(updatedTrail);
    setIsEditPanelVisible(false);
    setTrailToEdit(null);
  };

  // Handle trail selection and deselection
  const handleTrailClick = useCallback((trail: CachedTrail | null) => {
    setSelectedTrail(trail);
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
            onClick={() => setError('')}
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
        trails={trails}
        selectedTrail={selectedTrail}
        onBoundsChange={updateVisibleTrails}
        onTrailClick={handleTrailClick}
      />

      {/* Trail sidebar */}
      <TrailSidebar
        trails={trails}
        visibleTrails={visibleTrails}
        selectedTrail={selectedTrail}
        mapBounds={mapBounds}
        user={user}
        onTrailClick={handleTrailClick}
        onAddTrailClick={() => setIsUploadPanelVisible(true)}
        onAuthChange={handleAuthChange}
        onEditTrailClick={handleEditTrailClick}
      />


      {/* Upload panel */}
      <UploadPanel
        isVisible={isUploadPanelVisible}
        onClose={() => setIsUploadPanelVisible(false)}
        onTrailCreated={handleTrailCreated}
      />

      {/* Edit panel */}
      <TrailEditPanel
        isVisible={isEditPanelVisible}
        trail={trailToEdit}
        onClose={() => {
          setIsEditPanelVisible(false);
          setTrailToEdit(null);
        }}
        onTrailUpdated={handleTrailUpdatedComplete}
        onTrailDeleted={handleTrailDeleted}
      />
    </div>
  );
}

export default App;