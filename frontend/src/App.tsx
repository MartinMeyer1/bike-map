import React, { useState, useEffect, useCallback } from 'react';
import Map from './components/Map';
import AuthPanel from './components/AuthPanel';
import UploadPanel from './components/UploadPanel';
import TrailSidebar from './components/TrailSidebar';
import ElevationChart from './components/ElevationChart';
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
      
      // Refresh trails from cache
      refreshTrails();
    } catch (error) {
      console.error('Failed to add trail to cache:', error);
      setError('Failed to process uploaded trail');
    }
  };

  // Handle trail click (zoom to trail)
  const handleTrailClick = (trail: CachedTrail) => {
    // This could trigger a map zoom - implementation pending
  };

  // Show elevation chart in popup (called from Map component)
  const showElevationChart = (trail: CachedTrail, containerId: string) => {
    setTimeout(() => {
      const container = document.getElementById(containerId);
      if (container && trail.elevation) {
        // Clear container
        container.innerHTML = '';
        
        // Create chart placeholder
        const chartDiv = document.createElement('div');
        container.appendChild(chartDiv);
        
        // Show cached elevation data
        chartDiv.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #666;">
            <p><strong>Elevation Profile</strong></p>
            <p>D+: ${Math.round(trail.elevation.gain)}m | D-: ${Math.round(trail.elevation.loss)}m</p>
            <p>✅ Cached elevation data</p>
          </div>
        `;
      }
    }, 100);
  };

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
        Loading BikeMap & processing trails...
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
        onBoundsChange={updateVisibleTrails}
        onTrailClick={handleTrailClick}
      />

      {/* Trail sidebar */}
      <TrailSidebar
        trails={trails}
        visibleTrails={visibleTrails}
        mapBounds={mapBounds}
        user={user}
        onTrailClick={handleTrailClick}
        onAddTrailClick={() => setIsUploadPanelVisible(true)}
      />

      {/* Authentication panel */}
      <AuthPanel 
        user={user}
        onAuthChange={handleAuthChange}
      />

      {/* Upload panel */}
      <UploadPanel
        isVisible={isUploadPanelVisible}
        onClose={() => setIsUploadPanelVisible(false)}
        onTrailCreated={handleTrailCreated}
      />
    </div>
  );
}

export default App;