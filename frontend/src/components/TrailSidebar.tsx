import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { User, MVTTrail, Trail } from '../types';
import { PocketBaseService } from '../services/pocketbase';
import { downloadTrailGpx } from '../utils/trailFile';
import UserSection from './UserSection';
import { TrailCard } from './TrailCard';
import { QRModal } from './QRModal';
import { InfoModal } from './InfoModal';
import { RatingsCommentsModal } from './RatingsCommentsModal';
import { Button, Badge } from './ui';
import styles from './TrailSidebar.module.css';

interface TrailSidebarProps {
  visibleTrails: MVTTrail[]; // From MVT layer
  selectedTrail: MVTTrail | null;
  user: User | null;
  onTrailClick: (trail: MVTTrail) => void;
  onAddTrailClick: () => void;
  onEditTrailClick: (trail: MVTTrail) => void;
}

const TrailSidebar: React.FC<TrailSidebarProps> = memo(({
  visibleTrails,
  selectedTrail,
  user,
  onTrailClick, 
  onAddTrailClick,
  onEditTrailClick
}) => {
  const [showQRCode, setShowQRCode] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showRatingsComments, setShowRatingsComments] = useState<MVTTrail | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleShowQRCode = useCallback((trail: Trail) => {
    setShowQRCode(PocketBaseService.getTrailFileUrl(trail));
  }, []);

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

  // Bring the selected trail into view when the selection changes. The sort
  // below always places the selected trail first, so this is a scroll to the top
  // of the list -- which also means it works without asking the virtualizer to
  // resolve an off-screen row.
  //
  // This used to re-run on every map move, which meant panning with a trail
  // selected kept yanking the list back to it, at the cost of re-rendering every
  // card.
  useEffect(() => {
    if (!selectedTrail) {
      return;
    }

    // The delay waits out the map's fit-bounds animation before scrolling.
    let timeout: number | undefined;
    const frame = requestAnimationFrame(() => {
      timeout = window.setTimeout(() => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 400);
    });

    return () => {
      cancelAnimationFrame(frame);
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    };
  }, [selectedTrail]);



  // Sort trails to put selected trail first, then by rating, then by creation date
  const sortedTrails = React.useMemo(() => {
    if (!visibleTrails.length) return [];
    
    // Use a more stable sort to prevent unnecessary re-renders
    const sorted = [...visibleTrails].sort((a, b) => {
      // Selected trail always first
      if (selectedTrail?.id === a.id) return -1;
      if (selectedTrail?.id === b.id) return 1;
      
      // Then sort by rating average (highest first)
      const ratingA = a.rating_average || 0;
      const ratingB = b.rating_average || 0;
      if (ratingA !== ratingB) {
        return ratingB - ratingA; // Higher ratings first
      }
      
      // If ratings are equal, sort by creation date (most recent first)
      const dateA = new Date(a.created).getTime();
      const dateB = new Date(b.created).getTime();
      return dateB - dateA; // More recent first
    });
    
    // Engagement is built here rather than inline in the JSX below: a fresh
    // object literal per card per render defeats TrailCard's memo for the whole
    // list. Derived from fields on `trail`, so it stays valid as long as the
    // trail object does. userRating is still fetched by RatingsCommentsModal.
    return sorted.map((trail) => ({
      trail,
      engagement: {
        ratingStats: {
          average: trail.rating_average,
          count: trail.rating_count,
        },
        commentCount: trail.comment_count,
      },
    }));
  }, [visibleTrails, selectedTrail?.id]); // Only depend on selectedTrail.id, not full object

  // Only the rows on screen are mounted. Card heights genuinely vary -- long
  // names wrap, tag rows differ, the selected card expands -- so rows are
  // measured rather than assumed; estimateSize only seeds the scrollbar before
  // a row has been seen.
  const virtualizer = useVirtualizer({
    count: sortedTrails.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 150,
    overscan: 4,
    getItemKey: (index) => sortedTrails[index].trail.id,
  });

  return (
    <div className={styles.sidebar}>
      {/* Fixed Header Section */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>
            <img src="/rock.png" alt="BikeMap" style={{ width: '24px', height: '24px', verticalAlign: 'middle', marginRight: '6px' }} />
            BikeMap
          </h2>
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
            No trails visible in current area.<br />
            Pan the map to explore trails or {user ? 'upload a new trail!' : 'login to add trails.'}
          </div>
        ) : (
          <div
            className={styles.trailsContainer}
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const { trail, engagement } = sortedTrails[row.index];

              return (
                <div
                  key={row.key}
                  // measureElement reads this to know which row it just sized.
                  data-index={row.index}
                  ref={virtualizer.measureElement}
                  className={styles.virtualRow}
                  style={{ transform: `translateY(${row.start}px)` }}
                >
                  <TrailCard
                    trail={trail}
                    isSelected={selectedTrail?.id === trail.id}
                    user={user}
                    engagement={engagement}
                    onTrailClick={onTrailClick}
                    onEditTrailClick={onEditTrailClick}
                    onDownloadGPX={downloadTrailGpx}
                    onShowQRCode={handleShowQRCode}
                    onShowRatingsComments={handleShowRatingsComments}
                  />
                </div>
              );
            })}
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