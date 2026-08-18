import React from 'react';
import styles from '../forms.module.css';

interface GpxFieldProps {
  /** Unique per panel: both panels are mounted at once, so ids must not collide. */
  inputId: string;
  file: File | null;
  onFileChange: (file: File) => void;
  onStartDrawing: () => void;
  onError: (message: string) => void;
  onClearError: () => void;
  /** Create requires a track; edit keeps the existing one when left empty. */
  required: boolean;
  /** Shown when neither a file nor a drawn route is present, e.g. current file. */
  hint?: React.ReactNode;
  drawnGpxContent?: string;
}

export function GpxField({
  inputId,
  file,
  onFileChange,
  onStartDrawing,
  onError,
  onClearError,
  required,
  hint,
  drawnGpxContent,
}: GpxFieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    if (!chosen) return;

    if (!chosen.name.toLowerCase().endsWith('.gpx')) {
      onError('Please select a GPX file');
      return;
    }

    onFileChange(chosen);
    onClearError();
  };

  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>
        {required ? 'GPX FILE *' : 'GPX FILE — OPTIONAL, LEAVE EMPTY TO KEEP CURRENT'}
      </div>

      <div className={styles.fileRow}>
        <div className={styles.filePicker}>
          <label className={styles.fileButton} htmlFor={inputId}>
            CHOOSE FILE
          </label>
          <input
            type="file"
            id={inputId}
            className={styles.fileInput}
            accept=".gpx,application/gpx+xml"
            onChange={handleChange}
          />
          <span className={`${styles.fileName} ${file ? styles.fileNameSet : ''}`}>
            {file ? file.name : 'No file chosen'}
          </span>
        </div>

        <button type="button" className={styles.drawButton} onClick={onStartDrawing}>
          DRAW
        </button>
      </div>

      {drawnGpxContent && !file ? (
        <div className={styles.fileHint}>ROUTE DRAWN</div>
      ) : (
        !file && hint && <div className={styles.fileHint}>{hint}</div>
      )}
    </div>
  );
}
