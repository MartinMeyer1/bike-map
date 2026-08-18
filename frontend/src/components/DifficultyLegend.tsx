import { DIFFICULTY_LEVELS } from '../utils/constants';
import styles from './difficultyLegend.module.css';

/**
 * The six grades as one continuous bar, so the scale reads as a scale rather
 * than as six unrelated chips. Shown in the desktop sidebar footer, the mobile
 * legend block and the info dialog.
 */
export function DifficultyScale({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? `${styles.scale} ${styles.scaleCompact}` : styles.scale}>
      {DIFFICULTY_LEVELS.map((level) => (
        <div
          key={level.value}
          className={`${styles.cell} ${styles[level.value.toLowerCase()]}`}
        >
          {level.value}
        </div>
      ))}
    </div>
  );
}

function LineSample({ dashed, width }: { dashed?: boolean; width: number }) {
  return (
    <svg width={width} height="4" viewBox={`0 0 ${width} 4`} aria-hidden="true">
      <line
        x1="0"
        y1="2"
        x2={width}
        y2="2"
        stroke="var(--ink)"
        strokeWidth="2.5"
        strokeDasharray={dashed ? '5 4' : undefined}
      />
    </svg>
  );
}

interface LineKeyProps {
  /** Stacked on narrow panels, side by side where there is room. */
  layout?: 'row' | 'column';
  sampleWidth?: number;
}

/**
 * What solid and dashed mean on the map. This is the whole point of the `ridden`
 * flag, so the key sits next to the scale everywhere the scale appears.
 */
export function LineKey({ layout = 'row', sampleWidth = 34 }: LineKeyProps) {
  return (
    <div className={layout === 'row' ? styles.key : `${styles.key} ${styles.keyColumn}`}>
      <div className={styles.keyItem}>
        <LineSample width={sampleWidth} />
        <span className={styles.keyLabel}>RIDDEN — DETAILS CONFIRMED</span>
      </div>
      <div className={styles.keyItem}>
        <LineSample width={sampleWidth} dashed />
        <span className={styles.keyLabelMuted}>NOT RIDDEN — UNCONFIRMED</span>
      </div>
    </div>
  );
}
