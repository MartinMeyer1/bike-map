import { Trail } from '../../types';
import { DIFFICULTY_LEVELS } from '../../utils/constants';
import styles from '../forms.module.css';

interface LevelPickerProps {
  value: Trail['level'];
  onChange: (level: Trail['level']) => void;
}

/**
 * The S-grade scale as six cells rather than a <select>.
 *
 * A dropdown hid five of the six options and gave no sense of the scale being a
 * scale; here the colours sit in order and the chosen grade's description is
 * quoted underneath, so the choice can be checked against what it means.
 *
 * Real buttons with aria-pressed, so the picker is reachable by keyboard.
 */
export function LevelPicker({ value, onChange }: LevelPickerProps) {
  const chosen =
    DIFFICULTY_LEVELS.find((level) => level.value === value) ?? DIFFICULTY_LEVELS[0];

  return (
    <div>
      <div className={styles.levelPicker} role="group" aria-label="Difficulty level">
        {DIFFICULTY_LEVELS.map((level) => (
          <button
            key={level.value}
            type="button"
            className={`${styles.levelCell} ${styles[level.value.toLowerCase()]} ${
              level.value === value ? styles.levelCellOn : ''
            }`}
            onClick={() => onChange(level.value)}
            aria-pressed={level.value === value}
          >
            <span className={styles.levelBar} aria-hidden="true"></span>
            <span className={styles.levelGrade}>{level.value}</span>
            <span className={styles.levelWord}>{level.word}</span>
          </button>
        ))}
      </div>

      <p className={styles.levelDescription}>
        {chosen.value} · {chosen.word} — {chosen.description}
      </p>
    </div>
  );
}
