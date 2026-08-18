import React, { useEffect } from 'react';
import styles from './Toast.module.css';

export type ToastVariant = 'success' | 'error' | 'info';

/** The chip spells the variant out, so colour is never the only signal. */
const chipLabel: Record<ToastVariant, string> = {
  success: 'OK',
  error: 'ERROR',
  info: 'NOTE',
};

export interface Notice {
  id: number;
  message: string;
  variant: ToastVariant;
}

function NoticeRow({
  notice,
  onDismiss,
}: {
  notice: Notice;
  onDismiss: (id: number) => void;
}) {
  return (
    <div className={`${styles.toast} ${styles[notice.variant]}`} role="status">
      <span className={styles.chip}>{chipLabel[notice.variant]}</span>
      <span className={styles.message}>{notice.message}</span>
      <button
        className={styles.closeButton}
        onClick={() => onDismiss(notice.id)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export interface ToastStackProps {
  notices: Notice[];
  onDismiss: (id: number) => void;
}

/**
 * All notices share one fixed container so several can stand without
 * overlapping -- a share confirmation and a routing warning can arrive together.
 */
export const ToastStack: React.FC<ToastStackProps> = ({ notices, onDismiss }) => {
  if (notices.length === 0) return null;

  return (
    <div className={styles.stack}>
      {notices.map((notice) => (
        <NoticeRow key={notice.id} notice={notice} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  show: boolean;
  onClose: () => void;
  duration?: number;
}

/** Single self-dismissing notice, for callers that only ever raise one. */
export const Toast: React.FC<ToastProps> = ({
  message,
  variant = 'success',
  show,
  onClose,
  duration = 3000,
}) => {
  useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!show) return null;

  return (
    <ToastStack
      notices={[{ id: 0, message, variant }]}
      onDismiss={onClose}
    />
  );
};
