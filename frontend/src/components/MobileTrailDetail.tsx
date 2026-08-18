import React, { useCallback, useState } from 'react';
import { MVTTrail, User } from '../types';
import { PocketBaseService } from '../services/pocketbase';
import { useTrailDetails, useTrailElevation } from '../hooks';
import { Badge, ToastVariant } from './ui';
import { RatingsCommentsModal } from './RatingsCommentsModal';
import {
  TrailElevation,
  TrailEngagementButton,
  TrailMetadata,
  TrailProfile,
  TrailTagLine,
  UnconfirmedMark,
} from './TrailDetails';
import { shareTrail } from '../utils/shareUtils';
import { downloadTrailGpx } from '../utils/trailFile';
import styles from './MobileSheet.module.css';

interface MobileTrailDetailProps {
  trail: MVTTrail;
  user: User | null;
  onBack: () => void;
  onEditTrailClick: (trail: MVTTrail) => void;
  onShowToast: (message: string, variant: ToastVariant) => void;
}

/**
 * The selected trail, filling the sheet. Same content as the desktop expanded
 * row -- silhouette, provenance, description -- with Share in place of QR, since
 * a phone can hand the link straight to another app.
 */
export const MobileTrailDetail: React.FC<MobileTrailDetailProps> = ({
  trail,
  user,
  onBack,
  onEditTrailClick,
  onShowToast,
}) => {
  const [showRatings, setShowRatings] = useState(false);
  const { trail: detailedTrail, loading, error } = useTrailDetails(trail.id);
  const elevationSamples = useTrailElevation(detailedTrail);

  const handleShare = useCallback(async () => {
    try {
      const result = await shareTrail(trail);

      // The Web Share API gives its own feedback, so only the clipboard
      // fallback and outright failures need a notice.
      if (result === 'clipboard') {
        onShowToast('Link copied to clipboard!', 'success');
      } else if (result === 'failed') {
        onShowToast('Failed to share trail', 'error');
      }
    } catch (err) {
      console.error('Share error:', err);
      onShowToast('Failed to share trail', 'error');
    }
  }, [trail, onShowToast]);

  const canEdit = user && PocketBaseService.canEditTrail(trail, user);

  return (
    <div className={styles.detail}>
      <div className={styles.detailHead}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBack}
          aria-label="Back to trail list"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 5 8 12 15 19" />
          </svg>
        </button>
        <div className={styles.detailEyebrow}>TRAIL DETAIL</div>
      </div>

      <div className={styles.detailTitleRow}>
        <Badge level={trail.level} outlined={!trail.ridden} size="medium" />
        <div className={styles.detailIdentity}>
          <div className={styles.detailName}>{trail.name}</div>
          <TrailTagLine tags={trail.tags} />
        </div>
        {!trail.ridden && <UnconfirmedMark />}
      </div>

      <div className={styles.detailStats}>
        <TrailElevation elevation={trail.elevation} />
        <TrailEngagementButton
          ratingAverage={trail.rating_average}
          ratingCount={trail.rating_count}
          commentCount={trail.comment_count}
          onClick={() => setShowRatings(true)}
        />
      </div>

      <div className={styles.detailBody}>
        {loading ? (
          <div className={styles.detailNote}>LOADING TRAIL DETAILS…</div>
        ) : error ? (
          <div className={styles.detailError}>FAILED TO LOAD TRAIL DETAILS</div>
        ) : detailedTrail ? (
          <>
            <TrailProfile samples={elevationSamples} />
            <TrailMetadata trail={detailedTrail} distance={trail.distance} />
          </>
        ) : null}

        <div className={styles.detailActions}>
          <button
            type="button"
            className={styles.detailAction}
            disabled={!detailedTrail}
            onClick={() => detailedTrail && downloadTrailGpx(detailedTrail)}
          >
            GPX
          </button>

          <button type="button" className={styles.detailAction} onClick={handleShare}>
            SHARE
          </button>

          {canEdit && (
            <button
              type="button"
              className={`${styles.detailAction} ${styles.detailActionPrimary}`}
              onClick={() => onEditTrailClick(trail)}
            >
              EDIT
            </button>
          )}
        </div>
      </div>

      <RatingsCommentsModal
        isOpen={showRatings}
        onClose={() => setShowRatings(false)}
        trail={trail}
        user={user}
      />
    </div>
  );
};
