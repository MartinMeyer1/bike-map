import { useState, useEffect } from 'react';
import { Trail } from '../types';
import { PocketBaseService } from '../services/pocketbase';

interface UseTrailDetailsResult {
  trail: Trail | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTrailDetails(trailId: string | null): UseTrailDetailsResult {
  const [trail, setTrail] = useState<Trail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrailDetails = async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const trailData = await PocketBaseService.getTrail(id);
      setTrail(trailData);
    } catch (err) {
      console.error('Failed to fetch trail details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trail details');
      setTrail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (trailId) {
      fetchTrailDetails(trailId);
    } else {
      setTrail(null);
      setError(null);
      setLoading(false);
    }
  }, [trailId]);

  const refetch = () => {
    if (trailId) {
      fetchTrailDetails(trailId);
    }
  };

  return {
    trail,
    loading,
    error,
    refetch
  };
}