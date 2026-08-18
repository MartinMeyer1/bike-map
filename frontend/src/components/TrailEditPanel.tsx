import React, { useState } from 'react';
import { Trail, MVTTrail } from '../types';
import { PocketBaseService } from '../services/pocketbase';
import { handleApiError } from '../utils/errorHandling';
import { Modal, Button } from './ui';
import TrailForm from './TrailForm';
import {
  TrailFormValues,
  emptyTrailFormValues,
  buildTrailFormData,
} from '../utils/trailFormData';
import styles from './forms.module.css';

interface TrailEditPanelProps {
  isVisible: boolean;
  trail: MVTTrail | null;
  onClose: () => void;
  onTrailUpdated: (trail: Trail) => void;
  onTrailDeleted: (trailId: string) => void;
  onStartDrawing?: () => void;
  drawnGpxContent?: string;
}

export default function TrailEditPanel({
  isVisible,
  trail,
  onClose,
  onTrailUpdated,
  onTrailDeleted,
  onStartDrawing,
  drawnGpxContent,
}: TrailEditPanelProps) {
  const [values, setValues] = useState<TrailFormValues>(emptyTrailFormValues);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Update form data when trail changes (adjusted during render, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  const [lastTrail, setLastTrail] = useState<MVTTrail | null>(null);
  if (trail && trail !== lastTrail) {
    setLastTrail(trail);
    setValues({
      name: trail.name,
      description: trail.description || '',
      level: trail.level,
      tags: trail.tags || [],
      file: null, // Reset file when editing different trail
      ridden: trail.ridden || false,
    });
  }

  const handleStartDrawing = () => {
    if (!PocketBaseService.isAuthenticated()) {
      setError('You must be logged in to edit a trail. Please log in first.');
      return;
    }

    onStartDrawing?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Narrows the nullable prop for the body below; the render path already
    // bails out when trail is null.
    if (!trail) return;

    if (!values.name.trim()) {
      setError('Please enter a trail name');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const updatedTrail = await PocketBaseService.updateTrail(
        trail.id,
        buildTrailFormData(values, drawnGpxContent),
      );
      onTrailUpdated(updatedTrail);
      onClose();
    } catch (err: unknown) {
      setError(handleApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!trail) return;

    setIsDeleting(true);
    setError('');

    try {
      await PocketBaseService.deleteTrail(trail.id);
      onTrailDeleted(trail.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: unknown) {
      setError(handleApiError(err).message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isVisible || !trail) {
    return null;
  }

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title="✏️ Edit Trail"
        centerTitle
        showCloseButton={false}
        size="wide"
        closeOnOverlayClick={false}
      >
        {error && <div className={styles.errorBanner}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          <TrailForm
            idPrefix="edit"
            values={values}
            onChange={setValues}
            fileLabel="GPX File (optional - leave empty to keep current file)"
            selectedFileLabel="New file selected"
            fileHint={`Current file: ${trail.id}.gpx`}
            drawnGpxContent={drawnGpxContent}
            onStartDrawing={handleStartDrawing}
            onError={setError}
            onClearError={() => setError('')}
          />

          <div className={styles.actions}>
            <Button type="submit" variant="primary" size="large" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className={styles.spinner}></span>
                  Updating...
                </>
              ) : drawnGpxContent ? (
                '💾 Save Trail Route'
              ) : (
                '💾 Update Trail'
              )}
            </Button>

            <Button
              type="button"
              variant="danger"
              size="large"
              onClick={() => setShowDeleteConfirm(true)}
            >
              🗑️ Delete
            </Button>

            <Button type="button" variant="secondary" size="large" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={
          <>
            <div className={styles.deleteIcon}>🗑️</div>
            Delete Trail
          </>
        }
        headerVariant="danger"
        centerTitle
        showCloseButton={false}
        closeOnOverlayClick={false}
      >
        <div className={styles.deleteBody}>
          <p className={styles.deleteLead}>Are you sure you want to delete</p>
          <p className={styles.deleteName}>"{trail.name}"?</p>
          <p className={styles.deleteWarning}>This action cannot be undone.</p>

          <div className={styles.deleteActions}>
            <Button
              type="button"
              variant="danger"
              size="large"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <span className={styles.spinner}></span>
                  Deleting...
                </>
              ) : (
                '🗑️ Delete'
              )}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="large"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
