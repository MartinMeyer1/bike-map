import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { User, MVTTrail } from '../types';
import { CachedTrail } from '../services/trailCache';
import { PocketBaseService } from '../services/pocketbase';
import UserSection from './UserSection';
import { TrailCard } from './TrailCard';
import { QRModal } from './QRModal';
import { InfoModal } from './InfoModal';
import { RatingsCommentsModal } from './RatingsCommentsModal';
import { Button, Badge } from './ui';
import styles from './TrailSidebar.module.css';

interface TrailSidebarProps {
  trails: CachedTrail[]; // For CRUD operations (upload/edit)
  visibleTrails: MVTTrail[]; // From MVT layer
  selectedTrail: MVTTrail | null;
  mapMoveEndTrigger: number;
  user: User | null;
  onTrailClick: (trail: MVTTrail) => void;
  onAddTrailClick: () => void;
  onEditTrailClick: (trail: MVTTrail) => void;
}

const TrailSidebar: React.FC<TrailSidebarProps> = memo(({ 
  trails, 
  visibleTrails, 
  selectedTrail,
  mapMoveEndTrigger,
  user, 
  onTrailClick, 
  onAddTrailClick,
  onEditTrailClick
}) => {
  const [showQRCode, setShowQRCode] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showRatingsComments, setShowRatingsComments] = useState<MVTTrail | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleDownloadGPX = useCallback((trail: MVTTrail) => {
    // Create a trail-like object for PocketBase service
    const trailForDownload = {
      ...trail,
      file: `${trail.id}.gpx` // Reconstruct file name
    };
    const fileUrl = PocketBaseService.getTrailFileUrl(trailForDownload as any);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = `${trail.name}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleShowQRCode = useCallback((trail: MVTTrail) => {
    const trailForDownload = {
      ...trail,
      file: `${trail.id}.gpx`
    };
    const fileUrl = PocketBaseService.getTrailFileUrl(trailForDownload as any);
    setShowQRCode(fileUrl);
  }, []);

  // Memoize callback props to prevent TrailCard re-renders
  const memoizedOnTrailClick = useCallback((trail: MVTTrail) => {
    onTrailClick(trail);
  }, [onTrailClick]);

  const memoizedOnEditTrailClick = useCallback((trail: MVTTrail) => {
    onEditTrailClick(trail);
  }, [onEditTrailClick]);

  const handleCloseQRCode = useCallback(() => {
    setShowQRCode(null);
  }, []);

  const handleToggleInfoModal = useCallback(() => {
    setShowInfoModal(prev => !prev);
  }, []);

  const handleShowRatingsComments = useCallback((trail: MVTTrail) => {
    setShowRatingsComments(trail);
  }, []);

  const handleCloseRatingsComments = useCallback(() => {
    setShowRatingsComments(null);
  }, []);

  // Auto-scroll to selected trail when map movement ends
  useEffect(() => {
    if (selectedTrail && trailRefs.current[selectedTrail.id]) {
      const trailElement = trailRefs.current[selectedTrail.id];
      
      if (trailElement && scrollContainerRef.current) {
        // Use requestAnimationFrame for better performance and timing
        const scrollTimeout = requestAnimationFrame(() => {
          setTimeout(() => {
            trailElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            });
          }, 400);
        });
        
        return () => cancelAnimationFrame(scrollTimeout);
      }
    }
  }, [mapMoveEndTrigger, selectedTrail]);


  // Merge visible trails with cached trail data to get owner info - memoized
  const trailsWithOwnerInfo = React.useMemo(() => {
    if (!visibleTrails.length) return [];
    
    // Create a map of cached trails by ID for quick lookup
    const cachedTrailsMap = new Map(trails.map(trail => [trail.id, trail]));
    
    // Merge visible trails with cached data to get owner info
    const mergedTrails = visibleTrails.map(visibleTrail => {
      const cachedTrail = cachedTrailsMap.get(visibleTrail.id);
      return {
        ...visibleTrail,
        ownerInfo: cachedTrail?.ownerInfo
      };
    });
    
    return mergedTrails;
  }, [visibleTrails, trails]);

  // Sort trails to put selected trail first - memoized with stable sorting
  const sortedTrails = React.useMemo(() => {
    if (!trailsWithOwnerInfo.length) return [];
    
    // Use a more stable sort to prevent unnecessary re-renders
    const sorted = [...trailsWithOwnerInfo].sort((a, b) => {
      // Selected trail always first
      if (selectedTrail?.id === a.id) return -1;
      if (selectedTrail?.id === b.id) return 1;
      
      // Then sort by name for stable ordering
      return a.name.localeCompare(b.name);
    });
    
    return sorted;
  }, [trailsWithOwnerInfo, selectedTrail?.id]); // Only depend on selectedTrail.id, not full object

  return (
    <div className={styles.sidebar}>
      {/* Fixed Header Section */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>🤘 BikeMap</h2>
          {user && (user.role === 'Editor' || user.role === 'Admin') && (
            <Button 
              variant="success"
              size="small"
              onClick={onAddTrailClick}
              title="Add new trail"
            >
              ➕ Add Trail
            </Button>
          )}
        </div>

        {/* User Section */}
        <UserSection 
          user={user}
        />

        <div>
          <h4 className={styles.visibleTrailsTitle}>
            Visible Trails ({visibleTrails.length})
          </h4>
        </div>
      </div>

      {/* Scrollable Trails Section */}
      <div ref={scrollContainerRef} className={styles.scrollContainer}>
        {visibleTrails.length === 0 ? (
          <div className={styles.emptyState}>
            {trails.length === 0 ? 'No trails uploaded yet.' : 'No trails visible in current area.'}<br />
            {trails.length === 0 ? (user ? 'Upload the first trail!' : 'Login to add trails.') : 'Pan the map to explore more trails.'}
          </div>
        ) : (
          <div className={styles.trailsContainer}>
            {sortedTrails.map((trail) => (
              <div
                key={trail.id}
                ref={(el) => trailRefs.current[trail.id] = el}
              >
                <TrailCard
                  trail={trail}
                  isSelected={selectedTrail?.id === trail.id}
                  user={user}
                  engagement={{
                    ratingStats: {
                      average: trail.rating_average,
                      count: trail.rating_count,
                      // Note: userRating will still be fetched separately in RatingsCommentsModal
                      userRating: undefined
                    },
                    commentCount: trail.comment_count
                  }}
                  onTrailClick={memoizedOnTrailClick}
                  onEditTrailClick={memoizedOnEditTrailClick}
                  onDownloadGPX={handleDownloadGPX}
                  onShowQRCode={handleShowQRCode}
                  onShowRatingsComments={handleShowRatingsComments}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      <QRModal
        isOpen={!!showQRCode}
        onClose={handleCloseQRCode}
        fileUrl={showQRCode || ''}
      />

      {/* Ratings and Comments Modal */}
      <RatingsCommentsModal
        isOpen={!!showRatingsComments}
        onClose={handleCloseRatingsComments}
        trail={showRatingsComments}
        user={user}
      />

      {/* Fixed Footer Section */}
      <div className={styles.footer}>
        <div className={styles.legend}>
          <div className={styles.legendTitle}>
            <strong>Difficulty Legend:</strong>
          </div>
          <div className={styles.legendBadges}>
            <Badge level="S0" />
            <Badge level="S1" />
            <Badge level="S2" />
            <Badge level="S3" />
            <Badge level="S4" />
            <Badge level="S5" />
          </div>
          <button
            onClick={handleToggleInfoModal}
            className={styles.infoButton}
            title="App Information"
          >
            ℹ️
          </button>
        </div>
      </div>

      {/* Information Modal */}
      <InfoModal
        isOpen={showInfoModal}
        onClose={handleToggleInfoModal}
      />
    </div>
  );
});

TrailSidebar.displayName = 'TrailSidebar';

export default TrailSidebar;