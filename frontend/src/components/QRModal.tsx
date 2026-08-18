import React from 'react';
import { Modal, Button } from './ui';
import styles from './QRModal.module.css';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
}

export const QRModal: React.FC<QRModalProps> = ({ isOpen, onClose, fileUrl }) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="narrow"
      eyebrow="GPX DOWNLOAD"
      title="QR Code"
      showCloseButton={false}
      centerTitle
      footer={
        <Button variant="primary" size="large" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className={styles.content}>
        <div className={styles.qrFrame}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fileUrl)}`}
            alt="QR code linking to the trail's GPX file"
            className={styles.qrImage}
          />
        </div>

        <p className={styles.description}>
          Scan this QR code with your phone camera to download the GPX file directly to
          your device.
        </p>
      </div>
    </Modal>
  );
};
