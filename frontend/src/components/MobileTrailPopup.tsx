import React, { useState, useCallback } from 'react';
import { MVTTrail, User, Trail } from '../types';
import { PocketBaseService } from '../services/pocketbase';
import { useTrailDetails } from '../hooks';
import { Button, Badge } from './ui';
import { RatingsCommentsModal } from './RatingsCommentsModal';
import { shareTrail, ShareResult } from '../utils/shareUtils';
import styles from './MobileTrailPopup.module.css';

interface MobileTrailPopupProps {
  trail: MVTTrail | null;
  user: User | null;
  onClose: () => void;
  onEditTrailClick: (trail: MVTTrail) => void;
  onShowToast?: (message: string, variant: 'success' | 'error') => void;
}

export const MobileTrailPopup: React.FC<MobileTrailPopupProps> = ({
  trail,
  user,
  onClose,
  onEditTrailClick,
  onShowToast
}) => {
  const [showRatingsComments, setShowRatingsComments] = useState<MVTTrail | null>(null);

  // Fetch detailed trail information
  const { trail: detailedTrail, loading: trailLoading, error: trailError } = useTrailDetails(trail?.id || null);

  // Extract owner info - handle both string ID and User object
  const ownerInfo = detailedTrail?.owner && typeof detailedTrail.owner === 'object' ? detailedTrail.owner as User : null;

  const handleDownloadGPX = useCallback((downloadTrail: Trail) => {
    const fileUrl = PocketBaseService.getTrailFileUrl(downloadTrail);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = `${downloadTrail.name}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (trail) {
      onEditTrailClick(trail);
      onClose();
    }
  }, [trail, onEditTrailClick, onClose]);

  const handleShowRatingsComments = useCallback(() => {
    if (trail) {
      setShowRatingsComments(trail);
    }
  }, [trail]);

  const handleCloseRatingsComments = useCallback(() => {
    setShowRatingsComments(null);
  }, []);

  const handleShare = useCallback(async () => {
    if (!trail) return;

    try {
      const result: ShareResult = await shareTrail(trail);

      // Only show toast for clipboard success or failure
      // Web Share API provides its own feedback, so we don't need a toast
      if (result === 'clipboard' && onShowToast) {
        onShowToast('Link copied to clipboard!', 'success');
      } else if (result === 'failed' && onShowToast) {
        onShowToast('Failed to share trail', 'error');
      }
      // For 'web-share' and 'cancelled', no toast is shown
    } catch (error) {
      console.error('Share error:', error);
      if (onShowToast) {
        onShowToast('Failed to share trail', 'error');
      }
    }
  }, [trail, onShowToast]);

  if (!trail) return null;

  const canEdit = user && PocketBaseService.canEditTrail(trail, user);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.popup}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <h3 className={styles.title}>{trail.name}</h3>
            <Badge level={trail.level} />
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Tags */}
          {trail.tags && trail.tags.length > 0 && (
            <div className={styles.tags}>
              {trail.tags.map(tag => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          )}

          {/* Trail stats */}
          <div className={styles.stats}>
            <div className={styles.elevationStats}>
              {trail.elevation ? (
                <>
                  <div className={styles.elevationGain}>
                    <span>▲</span>
                    <span>{Math.round(trail.elevation.gain)}m</span>
                  </div>
                  <div className={styles.elevationLoss}>
                    <span>▼</span>
                    <span>{Math.round(trail.elevation.loss)}m</span>
                  </div>
                </>
              ) : (
                <span className={styles.gpxAvailable}>📁 GPX available</span>
              )}
            </div>

            {/* Engagement Stats */}
            <div className={styles.engagementContainer}>
              <button 
                className={styles.engagementButton}
                onClick={handleShowRatingsComments}
                title="View ratings and comments"
              >
                <div className={styles.engagementStats}>
                  {Number(trail.rating_count) > 0 ? (
                    <span className={styles.ratingDisplay}>
                      ⭐ {Number(trail.rating_average || 0).toFixed(1)} ({Number(trail.rating_count)})
                    </span>
                  ) : (
                    <span className={styles.noRating}>⭐ —</span>
                  )}
                  <span className={styles.commentDisplay}>
                    💬 {Number(trail.comment_count)}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Loading/Error states */}
          {trailLoading ? (
            <div className={styles.loadingState}>
              Loading trail details...
            </div>
          ) : trailError ? (
            <div className={styles.errorState}>
              Failed to load trail details
            </div>
          ) : detailedTrail ? (
            <>
              {/* Metadata */}
              <div className={styles.metadata}>
                <div className={styles.metadataItem}>
                  <span className={styles.metadataLabel}>Created:</span>
                  <span className={styles.metadataValue}>
                    {new Date(detailedTrail.created).toLocaleDateString()}
                  </span>
                </div>
                
                {ownerInfo && (
                  <div className={styles.metadataItem}>
                    <span className={styles.metadataLabel}>Author:</span>
                    <span className={styles.metadataValue}>
                      {ownerInfo.name || ownerInfo.email || 'Unknown'}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Description */}
              {detailedTrail.description && (
                <div className={styles.description}>
                  <div className={styles.descriptionLabel}>Description</div>
                  <div className={styles.descriptionText}>
                    {detailedTrail.description}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Action buttons */}
        <div className={styles.actions}>
          <Button
            variant="success"
            size="medium"
            onClick={() => detailedTrail && handleDownloadGPX(detailedTrail)}
            disabled={!detailedTrail}
          >
            📥 GPX
          </Button>

          <Button
            variant="primary"
            size="medium"
            onClick={handleShare}
          >
            🔗 Share
          </Button>

          {canEdit && (
            <Button
              variant="warning"
              size="medium"
              onClick={handleEdit}
            >
              ✏️ Edit
            </Button>
          )}
        </div>

        {/* Ratings and Comments Modal */}
        <RatingsCommentsModal
          isOpen={!!showRatingsComments}
          onClose={handleCloseRatingsComments}
          trail={showRatingsComments}
          user={user}
        />
      </div>
    </>
  );
};