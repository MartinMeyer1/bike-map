import { useState, useEffect, useCallback } from 'react';
import { Trail, MapBounds, MVTTrail } from '../types';
import { CachedTrail } from '../services/trailCache';
import trailCache from '../services/trailCache';

export const useTrails = () => {
  const [trails, setTrails] = useState<CachedTrail[]>([]); // For CRUD operations
  const [visibleTrails, setVisibleTrails] = useState<MVTTrail[]>([]); // From MVT
  const [selectedTrail, setSelectedTrail] = useState<MVTTrail | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const initializeTrails = useCallback(async () => {
    try {
      setIsLoading(true);
      await trailCache.initialize();
      const cachedTrails = trailCache.getAllTrails();
      setTrails(cachedTrails); // For CRUD operations only
      // visibleTrails will be populated by MVT layer
    } catch (err: unknown) {
      console.error('Failed to initialize trails:', err);
      setError('Failed to load trails');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshTrails = useCallback(() => {
    const cachedTrails = trailCache.getAllTrails();
    setTrails(cachedTrails);
    // visibleTrails managed by MVT layer now
  }, []);

  const updateVisibleTrails = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
    // Spatial filtering now handled automatically by MVT tiles
  }, []);

  // New method to handle trails loaded from MVT
  const updateVisibleTrailsFromMVT = useCallback((mvtTrails: MVTTrail[]) => {
    setVisibleTrails(mvtTrails);
  }, []);

  const handleTrailCreated = useCallback(async (newTrail: Trail) => {
    try {
      await trailCache.addTrail(newTrail);
      setTimeout(() => {
        refreshTrails();
      }, 1000);
    } catch (error) {
      console.error('Failed to add trail to cache:', error);
      setError('Failed to process uploaded trail');
    }
  }, [refreshTrails]);

  const handleTrailUpdated = useCallback(async (updatedTrail: Trail) => {
    try {
      await trailCache.updateTrail(updatedTrail);
      setTimeout(() => {
        refreshTrails();
      }, 1000);
    } catch (error) {
      console.error('Failed to update trail in cache:', error);
      setError('Failed to update trail');
    }
  }, [refreshTrails]);

  const handleTrailDeleted = useCallback((trailId: string) => {
    try {
      trailCache.removeTrail(trailId);
      
      if (selectedTrail?.id === trailId) {
        setSelectedTrail(null);
      }
      
      refreshTrails();
    } catch (error) {
      console.error('Failed to remove trail from cache:', error);
      setError('Failed to remove trail');
    }
  }, [selectedTrail, refreshTrails]);

  const selectTrail = useCallback((trail: MVTTrail | null) => {
    setSelectedTrail(trail);
  }, []);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  useEffect(() => {
    initializeTrails();
  }, [initializeTrails]);

  return {
    trails,
    visibleTrails,
    selectedTrail,
    mapBounds,
    isLoading,
    error,
    selectTrail,
    updateVisibleTrails,
    updateVisibleTrailsFromMVT,
    handleTrailCreated,
    handleTrailUpdated,
    handleTrailDeleted,
    refreshTrails,
    clearError
  };
};