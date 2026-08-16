import React from 'react';
import { DIFFICULTY_LEVELS, AVAILABLE_TAGS } from '../utils/constants';
import { TrailFormValues } from '../utils/trailFormData';
import { Button } from './ui';
import styles from './forms.module.css';

interface TrailFormProps {
  /** Unique per panel: both panels are mounted at once, so ids must not collide. */
  idPrefix: string;
  values: TrailFormValues;
  onChange: (values: TrailFormValues) => void;
  fileLabel: string;
  selectedFileLabel: string;
  /** Shown when neither a file nor a drawn route is present. */
  fileHint?: React.ReactNode;
  drawnGpxContent?: string;
  onStartDrawing: () => void;
  onError: (message: string) => void;
  onClearError: () => void;
}

export default function TrailForm({
  idPrefix,
  values,
  onChange,
  fileLabel,
  selectedFileLabel,
  fileHint,
  drawnGpxContent,
  onStartDrawing,
  onError,
  onClearError,
}: TrailFormProps) {
  const id = (field: string) => `${idPrefix}-${field}`;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    onChange({ ...values, [name]: value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.gpx')) {
      onError('Please select a GPX file');
      return;
    }

    onChange({ ...values, file });
    onClearError();
  };

  const handleTagChange = (tag: string, checked: boolean) => {
    onChange({
      ...values,
      tags: checked ? [...values.tags, tag] : values.tags.filter((t) => t !== tag),
    });
  };

  return (
    <>
      <div className={styles.formGroup}>
        <label htmlFor={id('file')}>{fileLabel}</label>
        <div className={styles.fileRow}>
          <input
            type="file"
            id={id('file')}
            accept=".gpx,application/gpx+xml"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="primary"
            size="small"
            className={styles.drawButton}
            onClick={onStartDrawing}
          >
            🎯 Draw
          </Button>
        </div>
        {values.file && (
          <div className={styles.fileHint}>
            {selectedFileLabel}: {values.file.name}
          </div>
        )}
        {drawnGpxContent && (
          <div className={styles.fileHintSuccess}>✅ Route drawn successfully</div>
        )}
        {!values.file && !drawnGpxContent && fileHint && (
          <div className={styles.fileHint}>{fileHint}</div>
        )}
      </div>

      <div className={styles.formGroup}>
        <label htmlFor={id('name')}>Trail Name *</label>
        <input
          type="text"
          id={id('name')}
          name="name"
          value={values.name}
          onChange={handleInputChange}
          required
          placeholder="e.g., Epic Singletrack"
          maxLength={100}
        />
      </div>

      <div className={styles.levelRow}>
        <div className={`${styles.formGroup} ${styles.levelField}`}>
          <label htmlFor={id('level')}>Difficulty Level *</label>
          <select
            id={id('level')}
            name="level"
            value={values.level}
            onChange={handleInputChange}
            required
          >
            {DIFFICULTY_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.value} ({level.name})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.riddenBox}>
          <label htmlFor={id('ridden')} className={styles.riddenLabel}>
            <span>Ridden</span>
            <input
              type="checkbox"
              id={id('ridden')}
              checked={values.ridden}
              onChange={(e) => onChange({ ...values, ridden: e.target.checked })}
            />
          </label>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label>Tags</label>
        <div className={styles.checkboxGroup}>
          {AVAILABLE_TAGS.map((tag) => (
            <label key={tag}>
              <input
                type="checkbox"
                checked={values.tags.includes(tag)}
                onChange={(e) => handleTagChange(tag, e.target.checked)}
              />
              {tag}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor={id('description')}>Description</label>
        <textarea
          id={id('description')}
          name="description"
          value={values.description}
          onChange={handleInputChange}
          placeholder="Optional description of the trail..."
          maxLength={500}
          rows={3}
        />
        <div className={styles.charCount}>{values.description.length}/500 characters</div>
      </div>
    </>
  );
}
