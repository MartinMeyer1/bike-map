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
      title="📱 QR Code Download"
      showCloseButton={false}
      centerTitle={true}
    >
      <div className={styles.content}>
        <div className={styles.qrContainer}>
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fileUrl)}`}
            alt="QR Code"
            className={styles.qrImage}
          />
        </div>
        
        <p className={styles.description}>
          Scan this QR code with your phone camera to download the GPX file directly to your device.
        </p>
        
        <Button 
          variant="secondary"
          onClick={onClose}
          className={styles.closeButton}
        >
          ✓ Close
        </Button>
      </div>
    </Modal>
  );
};