import React, { useState, useCallback } from 'react';
import { MVTTrail, User } from '../types';
import { PocketBaseService } from '../services/pocketbase';
import { useTrailDetails } from '../hooks';
import { Button, Badge } from './ui';
import { RatingsCommentsModal } from './RatingsCommentsModal';
import { TrailElevation, TrailEngagementButton, TrailMetadata } from './TrailDetails';
import { shareTrail } from '../utils/shareUtils';
import { downloadTrailGpx } from '../utils/trailFile';
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

  const { trail: detailedTrail, loading: trailLoading, error: trailError } =
    useTrailDetails(trail?.id || null);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (trail) {
      onEditTrailClick(trail);
      onClose();
    }
  }, [trail, onEditTrailClick, onClose]);

  const handleShare = useCallback(async () => {
    if (!trail) return;

    try {
      const result = await shareTrail(trail);

      // The Web Share API gives its own feedback, so only the clipboard
      // fallback and outright failures need a toast.
      if (result === 'clipboard') {
        onShowToast?.('Link copied to clipboard!', 'success');
      } else if (result === 'failed') {
        onShowToast?.('Failed to share trail', 'error');
      }
    } catch (error) {
      console.error('Share error:', error);
      onShowToast?.('Failed to share trail', 'error');
    }
  }, [trail, onShowToast]);

  if (!trail) return null;

  const canEdit = user && PocketBaseService.canEditTrail(trail, user);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.popup}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <h3 className={styles.title}>{trail.name}</h3>
            <Badge level={trail.level} />
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          {trail.tags && trail.tags.length > 0 && (
            <div className={styles.tags}>
              {trail.tags.map(tag => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          )}

          <div className={styles.stats}>
            <div className={styles.elevationStats}>
              <TrailElevation elevation={trail.elevation} />
            </div>

            <TrailEngagementButton
              ratingAverage={trail.rating_average}
              ratingCount={trail.rating_count}
              commentCount={trail.comment_count}
              onClick={() => setShowRatingsComments(trail)}
            />
          </div>

          {trailLoading ? (
            <div className={styles.loadingState}>Loading trail details...</div>
          ) : trailError ? (
            <div className={styles.errorState}>Failed to load trail details</div>
          ) : detailedTrail ? (
            <TrailMetadata trail={detailedTrail} />
          ) : null}
        </div>

        <div className={styles.actions}>
          <Button
            variant="primary"
            size="medium"
            onClick={() => detailedTrail && downloadTrailGpx(detailedTrail)}
            disabled={!detailedTrail}
          >
            📥 GPX
          </Button>

          <Button variant="primary" size="medium" onClick={handleShare}>
            🔗 Share
          </Button>

          {canEdit && (
            <Button variant="secondary" size="medium" onClick={handleEdit}>
              ✏️ Edit
            </Button>
          )}
        </div>

        <RatingsCommentsModal
          isOpen={!!showRatingsComments}
          onClose={() => setShowRatingsComments(null)}
          trail={showRatingsComments}
          user={user}
        />
      </div>
    </>
  );
};
