import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { MapBounds, User } from '../types';
import { CachedTrail } from '../services/trailCache';
import { PocketBaseService } from '../services/pocketbase';
import UserSection from './UserSection';
import { TrailCard } from './TrailCard';
import { QRModal } from './QRModal';
import { InfoModal } from './InfoModal';
import { Button, Badge } from './ui';
import styles from './TrailSidebar.module.css';

interface TrailSidebarProps {
  trails: CachedTrail[];
  visibleTrails: CachedTrail[];
  selectedTrail: CachedTrail | null;
  mapBounds: MapBounds | null;
  mapMoveEndTrigger: number;
  user: User | null;
  onTrailClick: (trail: CachedTrail) => void;
  onAddTrailClick: () => void;
  onAuthChange: (user: User | null) => void;
  onEditTrailClick: (trail: CachedTrail) => void;
}

const TrailSidebar: React.FC<TrailSidebarProps> = memo(({ 
  trails, 
  visibleTrails, 
  selectedTrail,
  mapMoveEndTrigger,
  user, 
  onTrailClick, 
  onAddTrailClick,
  onAuthChange,
  onEditTrailClick
}) => {
  const [showQRCode, setShowQRCode] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleDownloadGPX = useCallback((trail: CachedTrail) => {
    const fileUrl = PocketBaseService.getTrailFileUrl(trail);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = `${trail.name}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleShowQRCode = useCallback((trail: CachedTrail) => {
    const fileUrl = PocketBaseService.getTrailFileUrl(trail);
    setShowQRCode(fileUrl);
  }, []);

  const handleCloseQRCode = useCallback(() => {
    setShowQRCode(null);
  }, []);

  const handleToggleInfoModal = useCallback(() => {
    setShowInfoModal(prev => !prev);
  }, []);

  // Auto-scroll to selected trail when map movement ends
  useEffect(() => {
    if (selectedTrail && trailRefs.current[selectedTrail.id]) {
      const trailElement = trailRefs.current[selectedTrail.id];
      
      if (trailElement) {
        const scrollTimeout = setTimeout(() => {
          trailElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }, 400);
        
        return () => clearTimeout(scrollTimeout);
      }
    }
  }, [mapMoveEndTrigger, selectedTrail]);

  // Sort trails to put selected trail first
  const sortedTrails = React.useMemo(() => {
    const sorted = [...visibleTrails];
    if (selectedTrail) {
      const selectedIndex = sorted.findIndex(t => t.id === selectedTrail.id);
      if (selectedIndex > 0) {
        const [selected] = sorted.splice(selectedIndex, 1);
        sorted.unshift(selected);
      }
    }
    return sorted;
  }, [visibleTrails, selectedTrail]);

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
          onAuthChange={onAuthChange}
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
                  onTrailClick={onTrailClick}
                  onEditTrailClick={onEditTrailClick}
                  onDownloadGPX={handleDownloadGPX}
                  onShowQRCode={handleShowQRCode}
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