import { useState, useCallback, useEffect } from 'react';
import { Trail, MapBounds } from '../types';
import { mvtTrailExtractor } from '../services/mvtTrailExtractor';

/**
 * useTrails - Manages trail state from MVT tiles
 */
export const useTrails = () => {
  const [trails, setTrails] = useState<Trail[]>([]);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [error, setError] = useState('');

  // Listen to MVT trail extractor updates
  useEffect(() => {
    const updateTrails = () => {
      const extractedTrails = mvtTrailExtractor.getAllTrails();
      setTrails(extractedTrails);
    };

    updateTrails();
    mvtTrailExtractor.addListener(updateTrails);

    return () => {
      mvtTrailExtractor.removeListener(updateTrails);
    };
  }, []);

  const updateVisibleTrails = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
  }, []);

  const selectTrail = useCallback((trail: Trail | null) => {
    setSelectedTrail(trail);
  }, []);

  const handleTrailUpdated = useCallback((updatedTrail: Trail) => {
    if (selectedTrail?.id === updatedTrail.id) {
      setSelectedTrail(updatedTrail);
    }
  }, [selectedTrail]);

  const handleTrailDeleted = useCallback((trailId: string) => {
    if (selectedTrail?.id === trailId) {
      setSelectedTrail(null);
    }
  }, [selectedTrail]);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  return {
    trails,
    visibleTrails: trails, // MVT handles filtering
    selectedTrail,
    mapBounds,
    error,
    selectTrail,
    updateVisibleTrails,
    handleTrailUpdated,
    handleTrailDeleted,
    clearError
  };
};