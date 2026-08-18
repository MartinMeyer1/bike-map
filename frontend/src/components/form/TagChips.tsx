import { AVAILABLE_TAGS } from '../../utils/constants';
import styles from '../forms.module.css';

interface TagChipsProps {
  selected: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Tags as toggle chips rather than a row of checkboxes. Buttons with
 * aria-pressed, so what looks like a toggle behaves like one for keyboard and
 * screen-reader users too.
 */
export function TagChips({ selected, onChange }: TagChipsProps) {
  const toggle = (tag: string) => {
    onChange(
      selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag],
    );
  };

  return (
    <div className={styles.tagChips} role="group" aria-label="Tags">
      {AVAILABLE_TAGS.map((tag) => {
        const on = selected.includes(tag);

        return (
          <button
            key={tag}
            type="button"
            className={`${styles.tagChip} ${on ? styles.tagChipOn : ''}`}
            onClick={() => toggle(tag)}
            aria-pressed={on}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
