import { MVTTrail, Trail, User } from '../types';
import { ElevationSample } from '../hooks/useTrailElevation';
import { formatDate } from '../utils/format';
import styles from './trailDetails.module.css';

/** Elevation gain/loss pair, or a fallback when the trail has no profile yet. */
export function TrailElevation({ elevation }: { elevation?: MVTTrail['elevation'] }) {
  if (!elevation) {
    return <span className={styles.noElevation}>GPX AVAILABLE</span>;
  }

  return (
    <>
      <span className={styles.elevationGain}>
        <span aria-hidden="true">▲</span>
        <span>{Math.round(elevation.gain)}m</span>
        <span className={styles.srOnly}>climb</span>
      </span>
      <span className={styles.elevationLoss}>
        <span aria-hidden="true">▼</span>
        <span>{Math.round(elevation.loss)}m</span>
        <span className={styles.srOnly}>descent</span>
      </span>
    </>
  );
}

interface TrailEngagementButtonProps {
  ratingAverage: number;
  ratingCount: number;
  commentCount: number;
  onClick: () => void;
}

/**
 * Rating average and comment count.
 *
 * The mockups draw this as plain text, but it is the only way into the ratings
 * and comments dialog, so it stays a button -- with a hairline that only appears
 * on hover, to keep the row as quiet as the design intends.
 */
export function TrailEngagementButton({
  ratingAverage,
  ratingCount,
  commentCount,
  onClick,
}: TrailEngagementButtonProps) {
  const count = Number(ratingCount) || 0;
  const average = Number(ratingAverage) || 0;

  return (
    <button
      className={styles.engagementButton}
      onClick={onClick}
      title="View ratings and comments"
    >
      <span className={styles.rating}>
        <span aria-hidden="true">★</span>
        {count > 0 ? (
          <span>
            {average.toFixed(1)}
            <span className={styles.ratingCount}> ({count})</span>
          </span>
        ) : (
          <span>—</span>
        )}
        <span className={styles.srOnly}>
          {count > 0 ? `rated ${average.toFixed(1)} of 5 by ${count}` : 'not yet rated'}
        </span>
      </span>

      <span className={styles.separator} aria-hidden="true">·</span>

      <span className={styles.comments}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M1.4 3.1h11.2v6.4H5.6L2.9 12V9.5H1.4z" />
        </svg>
        <span>{Number(commentCount) || 0}</span>
        <span className={styles.srOnly}>comments</span>
      </span>
    </button>
  );
}

const PROFILE_WIDTH = 340;
const PROFILE_HEIGHT = 54;
const PROFILE_PAD = 2;

/**
 * The trail's elevation silhouette. Horizontal is distance, vertical is height
 * above the trail's own low point -- the scale is per trail, not absolute, so
 * the shape reads at any length.
 *
 * Renders nothing without at least two samples: a trail drawn without elevation
 * data has no silhouette to show, and an empty frame would imply flat ground.
 */
export function TrailProfile({ samples }: { samples: ElevationSample[] | null }) {
  if (!samples || samples.length < 2) {
    return null;
  }

  const elevations = samples.map((s) => s.elevation);
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const span = max - min || 1;
  const usable = PROFILE_HEIGHT - PROFILE_PAD * 2;
  const total = samples[samples.length - 1].distance || 1;

  const points = samples
    .map((sample) => {
      const x = (sample.distance / total) * PROFILE_WIDTH;
      const y = PROFILE_PAD + (1 - (sample.elevation - min) / span) * usable;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${PROFILE_WIDTH} ${PROFILE_HEIGHT}`}
      preserveAspectRatio="none"
      className={styles.profile}
      role="img"
      aria-label={`Elevation profile, ${Math.round(min)} to ${Math.round(max)} metres`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

interface TrailMetadataProps {
  trail: Trail;
  /** Length comes from the tile properties; the trail record has no distance. */
  distance?: number;
}

/**
 * The created/author/length row and the description. The owner arrives either as
 * an id string or, when expanded by PocketBase, as a full User record.
 */
export function TrailMetadata({ trail, distance }: TrailMetadataProps) {
  const owner =
    trail.owner && typeof trail.owner === 'object' ? (trail.owner as User) : null;

  return (
    <>
      <div className={styles.metadata}>
        <div className={styles.metadataItem}>
          <span className={styles.metadataLabel}>CREATED</span>
          <span className={styles.metadataValue}>{formatDate(trail.created)}</span>
        </div>

        {owner && (
          <div className={styles.metadataItem}>
            <span className={styles.metadataLabel}>AUTHOR</span>
            <span className={styles.metadataValue}>
              {owner.name || owner.email || 'Unknown'}
            </span>
          </div>
        )}

        {distance !== undefined && distance > 0 && (
          <div className={styles.metadataItem}>
            <span className={styles.metadataLabel}>LENGTH</span>
            <span className={styles.metadataValue}>
              {(distance / 1000).toFixed(1)} km
            </span>
          </div>
        )}
      </div>

      {trail.description && (
        <div className={styles.description}>
          <div className={styles.descriptionLabel}>DESCRIPTION</div>
          <div className={styles.descriptionText}>{trail.description}</div>
        </div>
      )}
    </>
  );
}

/** The dashed mark on a row whose grade nobody has confirmed by riding it. */
export function UnconfirmedMark() {
  // The badge beside it already states this for assistive tech, so the visible
  // mark is decoration -- announcing it twice would be noise.
  return (
    <span className={styles.unconfirmed} aria-hidden="true">
      UNCONF.
    </span>
  );
}

/** Comma-free tag line: NATURAL · FLOW. */
export function TrailTagLine({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) {
    return null;
  }

  return <div className={styles.tagLine}>{tags.join(' · ')}</div>;
}
