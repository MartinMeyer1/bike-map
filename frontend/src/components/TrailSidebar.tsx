import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
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

  // Scroll the selected trail into view when the selection changes. This used to
  // also re-run on every map move, which meant panning with a trail selected kept
  // yanking the list back to it -- and cost a full re-render of every card.
  useEffect(() => {
    if (selectedTrail) {
      // Looked up by attribute rather than held in a ref map: an inline ref
      // callback is a new function identity every render, so React would detach
      // and reattach every card's ref on each pass.
      const trailElement = scrollContainerRef.current?.querySelector(
        `[data-trail-id="${CSS.escape(selectedTrail.id)}"]`
      );

      if (trailElement) {
        // The delay waits out the map's fit-bounds animation before scrolling.
        let timeout: number | undefined;
        const frame = requestAnimationFrame(() => {
          timeout = window.setTimeout(() => {
            trailElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            });
          }, 400);
        });

        return () => {
          cancelAnimationFrame(frame);
          if (timeout !== undefined) {
            clearTimeout(timeout);
          }
        };
      }
    }
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
          <div className={styles.trailsContainer}>
            {sortedTrails.map(({ trail, engagement }) => (
              <div
                key={trail.id}
                data-trail-id={trail.id}
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