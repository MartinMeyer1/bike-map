import { MVTTrail, Trail, User } from '../types';
import { formatDate } from '../utils/format';
import styles from './trailDetails.module.css';

/** Elevation gain/loss pair, or a fallback when the trail has no profile yet. */
export function TrailElevation({ elevation }: { elevation?: MVTTrail['elevation'] }) {
  if (!elevation) {
    return <span className={styles.gpxAvailable}>📁 GPX available</span>;
  }

  return (
    <>
      <div className={styles.elevationGain}>
        <span>▲</span>
        <span>{Math.round(elevation.gain)}m</span>
      </div>
      <div className={styles.elevationLoss}>
        <span>▼</span>
        <span>{Math.round(elevation.loss)}m</span>
      </div>
    </>
  );
}

interface TrailEngagementButtonProps {
  ratingAverage: number;
  ratingCount: number;
  commentCount: number;
  onClick: () => void;
}

export function TrailEngagementButton({
  ratingAverage,
  ratingCount,
  commentCount,
  onClick,
}: TrailEngagementButtonProps) {
  const count = Number(ratingCount) || 0;

  return (
    <button
      className={styles.engagementButton}
      onClick={onClick}
      title="View ratings and comments"
    >
      <div className={styles.engagementStats}>
        {count > 0 ? (
          <span className={styles.ratingDisplay}>
            ⭐ {(Number(ratingAverage) || 0).toFixed(1)} ({count})
          </span>
        ) : (
          <span className={styles.noRating}>⭐ —</span>
        )}
        <span className={styles.commentDisplay}>💬 {Number(commentCount) || 0}</span>
      </div>
    </button>
  );
}

/**
 * Created/author metadata plus the description. The owner arrives either as an
 * id string or, when expanded by PocketBase, as a full User record.
 */
export function TrailMetadata({ trail }: { trail: Trail }) {
  const owner =
    trail.owner && typeof trail.owner === 'object' ? (trail.owner as User) : null;

  return (
    <>
      <div className={styles.metadata}>
        <div className={styles.metadataItem}>
          <span className={styles.metadataLabel}>Created:</span>
          <span className={styles.metadataValue}>{formatDate(trail.created)}</span>
        </div>

        {owner && (
          <div className={styles.metadataItem}>
            <span className={styles.metadataLabel}>Author:</span>
            <span className={styles.metadataValue}>
              {owner.name || owner.email || 'Unknown'}
            </span>
          </div>
        )}
      </div>

      {trail.description && (
        <div className={styles.description}>
          <div className={styles.descriptionLabel}>Description</div>
          <div className={styles.descriptionText}>{trail.description}</div>
        </div>
      )}
    </>
  );
}
