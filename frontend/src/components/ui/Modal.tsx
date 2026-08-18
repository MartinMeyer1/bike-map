import React from 'react';
import styles from './Modal.module.css';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Mono kicker above the title: "EDIT TRAIL", "NEW ENTRY", "ACCOUNT". */
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Action bar rendered under the scroll area, on recessed paper. */
  footer?: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
  centerTitle?: boolean;
  centerFooter?: boolean;
  /** `danger` fills the header band; every other dialog is paper. */
  headerVariant?: 'paper' | 'danger';
  size?: 'narrow' | 'default' | 'medium' | 'wide';
  /** Forms set this false so a stray backdrop click cannot discard input. */
  closeOnOverlayClick?: boolean;
}

const sizeClass = {
  narrow: styles.narrow,
  default: '',
  medium: styles.medium,
  wide: styles.wide,
} as const;

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  eyebrow,
  title,
  children,
  footer,
  className,
  showCloseButton = true,
  centerTitle = false,
  centerFooter = false,
  headerVariant = 'paper',
  size = 'default',
  closeOnOverlayClick = true
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={closeOnOverlayClick ? onClose : undefined}>
      <div
        className={[styles.modal, sizeClass[size], className].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {(eyebrow || title) && (
          <div
            className={[
              styles.header,
              headerVariant === 'danger' ? styles.danger : '',
              centerTitle ? styles.centeredHeader : '',
            ].filter(Boolean).join(' ')}
          >
            <div className={styles.titleGroup}>
              {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
              {title && <h3 className={styles.title}>{title}</h3>}
            </div>
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

        {footer && (
          <div
            className={[styles.footer, centerFooter ? styles.centeredFooter : '']
              .filter(Boolean)
              .join(' ')}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
