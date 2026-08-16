import React from 'react';
import styles from './Modal.module.css';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
  centerTitle?: boolean;
  headerVariant?: 'blue' | 'purple' | 'success' | 'warning' | 'danger';
  size?: 'default' | 'wide';
  /** Forms set this false so a stray backdrop click cannot discard input. */
  closeOnOverlayClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  showCloseButton = true,
  centerTitle = false,
  headerVariant = 'blue',
  size = 'default',
  closeOnOverlayClick = true
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={closeOnOverlayClick ? onClose : undefined}>
      <div
        className={`${styles.modal} ${size === 'wide' ? styles.wide : ''} ${className || ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className={`${styles.header} ${styles[headerVariant]} ${centerTitle ? styles.centeredHeader : ''}`}>
            <h3 className={styles.title}>{title}</h3>
            {showCloseButton && (
              <button 
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Close modal"
              >
                ×
              </button>
            )}
          </div>
        )}
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
};