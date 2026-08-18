import React, { useState } from 'react';
import { User } from '../types';
import { PocketBaseService } from '../services/pocketbase';
import { getErrorMessage } from '../utils/errorHandling';
import { Modal, Button } from './ui';
import styles from './forms.module.css';

interface UsernameEditModalProps {
  isVisible: boolean;
  user: User;
  onClose: () => void;
  onUserUpdated: (user: User) => void;
}

export default function UsernameEditModal({
  isVisible,
  user,
  onClose,
  onUserUpdated
}: UsernameEditModalProps) {
  const [newName, setNewName] = useState(user.name || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim()) {
      setError('Please enter a username');
      return;
    }

    if (newName.trim() === user.name) {
      onClose();
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const updatedUser = await PocketBaseService.updateUser(user.id, {
        name: newName.trim()
      });

      onUserUpdated(updatedUser);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isVisible}
      onClose={onClose}
      eyebrow="ACCOUNT"
      title="Edit Username"
      showCloseButton={false}
      closeOnOverlayClick={false}
      footer={
        <>
          <Button
            type="submit"
            form="username-form"
            variant="primary"
            size="large"
            disabled={isLoading || !newName.trim()}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner}></span>
                Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="large"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </>
      }
    >
      {error && <div className={styles.errorBanner}>
        <span className={styles.errorChip}>ERROR</span>
        <span>{error}</span>
      </div>}

      {/*
       * The submit button lives in the modal's footer, outside this element, so
       * it reaches the form by id rather than by nesting.
       */}
      <form id="username-form" onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="username">
            USERNAME
          </label>
          <input
            type="text"
            id="username"
            className={styles.input}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter your display name"
            maxLength={50}
            autoFocus
          />
          <div className={styles.charCount}>{newName.length}/50 CHARACTERS</div>
        </div>
      </form>
    </Modal>
  );
}
