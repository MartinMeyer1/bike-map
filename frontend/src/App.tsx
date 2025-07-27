import React, { useState, useEffect, useCallback } from 'react';
import Map from './components/Map';
import AuthPanel from './components/AuthPanel';
import UploadPanel from './components/UploadPanel';
import TrailSidebar from './components/TrailSidebar';
import ElevationChart from './components/ElevationChart';
import { Trail, User, MapBounds } from './types';
import { PocketBaseService } from './services/pocketbase';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [visibleTrails, setVisibleTrails] = useState<Trail[]>([]);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [isUploadPanelVisible, setIsUploadPanelVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Initialize app - check auth and load trails
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check if user is already authenticated
        const currentUser = PocketBaseService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }

        // Load trails
        await loadTrails();
      } catch (err: any) {
        console.error('Failed to initialize app:', err);
        setError('Failed to load application data');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Load trails from PocketBase
  const loadTrails = useCallback(async () => {
    try {
      setError(''); // Clear any previous errors
      const trailsData = await PocketBaseService.getTrails();
      setTrails(trailsData);
    } catch (err: any) {
      console.error('Failed to load trails:', err);
      setError('Failed to load trails');
    }
  }, []);

  // Update visible trails when map bounds change
  const updateVisibleTrails = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
    
    // For now, show all trails since we don't have track points
    // We'll implement GPX-based filtering later
    setVisibleTrails(trails);
  }, [trails]);

  // Handle authentication changes
  const handleAuthChange = (newUser: User | null) => {
    setUser(newUser);
  };

  // Handle trail creation
  const handleTrailCreated = async (newTrail: Trail) => {
    setTrails(prev => [newTrail, ...prev]);
    
    // Refresh trails to get updated data (elevation processing might be done)
    setTimeout(() => {
      loadTrails();
    }, 2000);
  };

  // Handle trail click (zoom to trail)
  const handleTrailClick = (trail: Trail) => {
    // This could trigger a map zoom - implementation pending
  };

  // Show elevation chart in popup (called from Map component)
  const showElevationChart = (trail: Trail, containerId: string) => {
    setTimeout(() => {
      const container = document.getElementById(containerId);
      if (container) {
        // Clear container
        container.innerHTML = '';
        
        // Create placeholder
        const chartDiv = document.createElement('div');
        container.appendChild(chartDiv);
        
        // Show message about GPX processing
        chartDiv.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #666;">
            <p>Elevation Profile</p>
            <p>GPX file processing will be done client-side</p>
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
        Loading MioBike...
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