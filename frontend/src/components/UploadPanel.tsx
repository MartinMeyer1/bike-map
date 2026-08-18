import React, { useState } from 'react';
import { Trail } from '../types';
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

interface UploadPanelProps {
  isVisible: boolean;
  onClose: () => void;
  onTrailCreated: (trail: Trail) => void;
  onStartDrawing?: () => void;
  drawnGpxContent?: string;
}

const FILE_INPUT_ID = 'upload-file';

export default function UploadPanel({
  isVisible,
  onClose,
  onTrailCreated,
  onStartDrawing,
  drawnGpxContent,
}: UploadPanelProps) {
  const [values, setValues] = useState<TrailFormValues>(emptyTrailFormValues);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStartDrawing = () => {
    if (!PocketBaseService.isAuthenticated()) {
      setError('You must be logged in to create a trail. Please log in first.');
      return;
    }

    onStartDrawing?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!PocketBaseService.isAuthenticated()) {
      setError('You must be logged in to create a trail. Please log in first.');
      return;
    }

    if (!values.file && !drawnGpxContent) {
      setError('Please select a GPX file or draw a route');
      return;
    }

    if (!values.name.trim()) {
      setError('Please enter a trail name');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const submitData = buildTrailFormData(values, drawnGpxContent);

      const currentUser = PocketBaseService.getCurrentUser();
      if (currentUser) {
        submitData.append('owner', currentUser.id);
      }

      const trail = await PocketBaseService.createTrail(submitData);
      onTrailCreated(trail);

      setValues(emptyTrailFormValues);

      // The file input keeps its selection even after the state resets.
      const fileInput = document.getElementById(FILE_INPUT_ID) as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = '';
      }

      onClose();
    } catch (err: unknown) {
      setError(handleApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isVisible}
      onClose={onClose}
      size="wide"
      eyebrow="NEW ENTRY"
      title="Add New Trail"
      showCloseButton={false}
      closeOnOverlayClick={false}
      footer={
        <>
          {/*
           * The action bar sits outside the scrolling body, so the submit button
           * reaches its form by id rather than by nesting.
           */}
          <Button
            type="submit"
            form="upload-form"
            variant="primary"
            size="large"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner}></span>
                {drawnGpxContent ? 'Saving…' : 'Uploading…'}
              </>
            ) : drawnGpxContent ? (
              'Save trail'
            ) : (
              'Upload trail'
            )}
          </Button>

          <Button type="button" variant="secondary" size="large" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      {error && (
        <div className={styles.errorBanner}>
          <span className={styles.errorChip}>ERROR</span>
          <span>{error}</span>
        </div>
      )}

      <form id="upload-form" onSubmit={handleSubmit}>
        <TrailForm
          idPrefix="upload"
          mode="create"
          values={values}
          onChange={setValues}
          drawnGpxContent={drawnGpxContent}
          onStartDrawing={handleStartDrawing}
          onError={setError}
          onClearError={() => setError('')}
        />
      </form>
    </Modal>
  );
}
