import React from 'react';
import { MVTTrail } from '../types';
import { Badge } from './ui';
import { TrailElevation, TrailEngagementReadout, TrailTagLine } from './TrailDetails';
import styles from './MobileSheet.module.css';

interface MobileTrailStripProps {
  trails: MVTTrail[];
  selectedId?: string;
  onOpen: (trail: MVTTrail) => void;
}

/**
 * The visible trails as a horizontal, snap-scrolling strip.
 *
 * A vertical list would need most of the screen to be useful, which is the one
 * thing a map cannot spare; a strip shows three or four trails in the height of
 * one row and leaves the map above it intact.
 */
export const MobileTrailStrip: React.FC<MobileTrailStripProps> = ({
  trails,
  selectedId,
  onOpen,
}) => {
  return (
    <div className={styles.strip}>
      {trails.map((trail) => (
        <button
          type="button"
          key={trail.id}
          className={`${styles.card} ${trail.id === selectedId ? styles.cardSelected : ''}`}
          onClick={() => onOpen(trail)}
        >
          <span className={styles.cardHead}>
            <Badge level={trail.level} outlined={!trail.ridden} />
            <span className={styles.cardIdentity}>
              <span className={styles.cardName}>{trail.name}</span>
              <TrailTagLine tags={trail.tags} />
            </span>
          </span>

          <span className={styles.cardStats}>
            <TrailElevation elevation={trail.elevation} />
            <TrailEngagementReadout
              ratingAverage={trail.rating_average}
              ratingCount={trail.rating_count}
              commentCount={trail.comment_count}
            />
          </span>
        </button>
      ))}
    </div>
  );
};
