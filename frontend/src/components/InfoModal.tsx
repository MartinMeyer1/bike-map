import React from 'react';
import { Modal, Button, Badge } from './ui';
import { DIFFICULTY_LEVELS } from '../utils/constants';
import styles from './InfoModal.module.css';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <>
          <img src="/rock.png" alt="" className={styles.titleIcon} />
          About BikeMap
        </>
      }
      showCloseButton={false}
      centerTitle={true}
    >
      <div>
        <section className={styles.section}>
          <h4 className={styles.heading}>🚵 Mountain Bike Trail Sharing</h4>
          <p className={styles.body}>
            BikeMap is a community-driven platform for sharing and discovering mountain
            bike trails. Upload your favorite trails, explore new routes, and connect with
            fellow riders.
          </p>
        </section>

        <section className={styles.section}>
          <h4 className={styles.heading}>🎯 Difficulty Levels</h4>
          <div className={styles.levels}>
            {DIFFICULTY_LEVELS.map((level) => (
              <div key={level.value} className={styles.level}>
                <div className={styles.levelHeader}>
                  <Badge level={level.value} />
                  <span className={styles.levelName}>{level.name}</span>
                </div>
                <p className={styles.levelDescription}>{level.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h4 className={styles.heading}>🛤️ Trail Segments vs Tours</h4>
          <p className={styles.body}>
            We prefer individual trail segments over complete tours. This allows riders to
            mix and match trails based on their skill level and preferences, creating
            custom riding experiences.
          </p>
        </section>

        <section className={styles.section}>
          <h4 className={styles.heading}>💻 Open Source</h4>
          <p className={styles.body}>
            BikeMap is open source! Check out the code, contribute, or report issues:
          </p>
          <a
            href="https://github.com/MartinMeyer1/bike-map"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.githubLink}
          >
            📂 GitHub Repository
          </a>
        </section>

        <div className={styles.footer}>
          <Button variant="primary" onClick={onClose}>
            ✓ Got it!
          </Button>
        </div>
      </div>
    </Modal>
  );
};
