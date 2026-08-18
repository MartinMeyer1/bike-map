import React from 'react';
import { TrailFormValues } from '../utils/trailFormData';
import { RiddenBand } from './form/RiddenBand';
import { LevelPicker } from './form/LevelPicker';
import { TagChips } from './form/TagChips';
import { GpxField } from './form/GpxField';
import styles from './forms.module.css';

interface TrailFormProps {
  /** Unique per panel: both panels are mounted at once, so ids must not collide. */
  idPrefix: string;
  /**
   * Create requires a GPX track and says so; edit keeps the stored one when the
   * field is left empty. Nothing else about the form differs between the two.
   */
  mode: 'create' | 'edit';
  values: TrailFormValues;
  onChange: (values: TrailFormValues) => void;
  /** Shown under the file row when nothing new has been picked. */
  fileHint?: React.ReactNode;
  drawnGpxContent?: string;
  onStartDrawing: () => void;
  onError: (message: string) => void;
  onClearError: () => void;
}

/**
 * The trail form, shared verbatim by the add and edit panels. Field order runs
 * from the claim being made (ridden) down through what is being described --
 * name, grade, tags, words -- to the track itself.
 */
export default function TrailForm({
  idPrefix,
  mode,
  values,
  onChange,
  fileHint,
  drawnGpxContent,
  onStartDrawing,
  onError,
  onClearError,
}: TrailFormProps) {
  const id = (field: string) => `${idPrefix}-${field}`;
  const patch = (fields: Partial<TrailFormValues>) => onChange({ ...values, ...fields });

  return (
    <div className={styles.form}>
      <RiddenBand
        ridden={values.ridden}
        level={values.level}
        onChange={(ridden) => patch({ ridden })}
      />

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={id('name')}>
          TRAIL NAME *
        </label>
        <input
          type="text"
          id={id('name')}
          className={styles.input}
          value={values.name}
          onChange={(e) => patch({ name: e.target.value })}
          required
          placeholder="e.g., Epic Singletrack"
          maxLength={100}
        />
      </div>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>DIFFICULTY LEVEL *</div>
        <LevelPicker value={values.level} onChange={(level) => patch({ level })} />
      </div>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>TAGS</div>
        <TagChips selected={values.tags} onChange={(tags) => patch({ tags })} />
      </div>

      <div className={styles.field}>
        <div className={styles.fieldLabelRow}>
          <label className={styles.fieldLabel} htmlFor={id('description')}>
            DESCRIPTION
          </label>
          <span className={styles.charCount}>
            {values.description.length}/500 CHARACTERS
          </span>
        </div>
        <textarea
          id={id('description')}
          className={styles.textarea}
          value={values.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Optional description of the trail..."
          maxLength={500}
          rows={3}
        />
      </div>

      <GpxField
        inputId={id('file')}
        file={values.file}
        onFileChange={(file) => patch({ file })}
        onStartDrawing={onStartDrawing}
        onError={onError}
        onClearError={onClearError}
        required={mode === 'create'}
        hint={fileHint}
        drawnGpxContent={drawnGpxContent}
      />
    </div>
  );
}
