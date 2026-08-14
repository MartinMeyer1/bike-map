import { useState, useEffect, useTransition } from 'react';
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
  const [error, setError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  const fetchTrailDetails = async (id: string) => {
    setError(null);

    try {
      const trailData = await PocketBaseService.getTrail(id);
      setTrail(trailData);
    } catch (err) {
      console.error('Failed to fetch trail details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trail details');
      setTrail(null);
    }
  };

  useEffect(() => {
    if (trailId) {
      startTransition(() => fetchTrailDetails(trailId));
    } else {
      startTransition(() => {
        setTrail(null);
        setError(null);
      });
    }
  }, [trailId]);

  const refetch = () => {
    if (trailId) {
      startTransition(() => fetchTrailDetails(trailId));
    }
  };

  return {
    trail,
    loading,
    error,
    refetch
  };
}