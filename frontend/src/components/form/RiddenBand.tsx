import { Trail } from '../../types';
import { Badge } from '../ui';
import styles from '../forms.module.css';

interface RiddenBandProps {
  ridden: boolean;
  level: Trail['level'];
  onChange: (ridden: boolean) => void;
}

/**
 * The ridden flag, as a band the whole width of the form.
 *
 * It is not a checkbox in a row of fields because it does not describe the trail
 * the way the fields below do -- it vouches for them. Ticking it says the grade,
 * tags and description have been confirmed by an actual ride, which is what
 * turns the trail's line solid on the map and fills in its badge. The preview
 * swatch on the right shows exactly that consequence.
 */
export function RiddenBand({ ridden, level, onChange }: RiddenBandProps) {
  return (
    <button
      type="button"
      className={`${styles.riddenBand} ${ridden ? styles.riddenBandOn : ''}`}
      onClick={() => onChange(!ridden)}
      aria-pressed={ridden}
    >
      <span className={styles.riddenBox} aria-hidden="true"></span>

      <span>
        <span className={styles.riddenTitle}>
          {ridden
            ? 'Ridden — level and details confirmed'
            : 'Not ridden — details unconfirmed'}
        </span>
        <span className={styles.riddenHint}>
          {ridden
            ? 'Someone has ridden this, so the level, tags and description above are vouched for. The trail draws as a solid line on the map and its badge shows filled.'
            : 'Tick this once the trail has actually been ridden: it confirms the level and details above. Until then it draws as a dashed line on the map and its badge stays hollow.'}
        </span>
      </span>

      <span className={styles.riddenPreview}>
        <Badge level={level} outlined={!ridden} size="large" />
      </span>
    </button>
  );
}
