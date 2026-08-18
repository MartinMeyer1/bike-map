import React from 'react';
import { Modal, Button, Badge } from './ui';
import { LineKey } from './DifficultyLegend';
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
      size="medium"
      showCloseButton={false}
      centerTitle
      centerFooter
      title={
        <span className={styles.titleRow}>
          <img src="/rock.png" alt="" className={styles.titleIcon} />
          About BikeMap
        </span>
      }
      footer={
        <Button variant="primary" size="large" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <div className={styles.sections}>
        <section>
          <h4 className={styles.heading}>MOUNTAIN BIKE TRAIL SHARING</h4>
          <p className={styles.body}>
            BikeMap is a community-driven platform for sharing and discovering mountain
            bike trails. Upload your favorite trails, explore new routes, and connect with
            fellow riders.
          </p>
        </section>

        <section>
          <h4 className={styles.heading}>DIFFICULTY LEVELS</h4>
          <div className={styles.levels}>
            {DIFFICULTY_LEVELS.map((level) => (
              <div key={level.value} className={styles.level}>
                <Badge level={level.value} />
                <div>
                  <div className={styles.levelName}>{level.name}</div>
                  <p className={styles.levelDescription}>{level.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/*
         * What the ridden flag actually means. It was previously explained
         * nowhere, which left the solid and dashed lines on the map, and the
         * filled and hollow badges, looking like decoration.
         */}
        <section>
          <h4 className={styles.heading}>SOLID VS DASHED LINES</h4>
          <p className={styles.body}>
            A solid line means someone has ridden the trail and confirmed its level, tags
            and description. A dashed line means the trail has been added but not yet
            ridden, so its details are still unconfirmed.
          </p>
          <LineKey layout="column" sampleWidth={48} />
        </section>

        <section>
          <h4 className={styles.heading}>TRAIL SEGMENTS VS TOURS</h4>
          <p className={styles.body}>
            We prefer individual trail segments over complete tours. This allows riders to
            mix and match trails based on their skill level and preferences, creating
            custom riding experiences.
          </p>
        </section>

        <section>
          <h4 className={styles.heading}>OPEN SOURCE</h4>
          <p className={styles.body}>
            BikeMap is open source! Check out the code, contribute, or report issues:
          </p>
          <a
            href="https://github.com/MartinMeyer1/bike-map"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.githubLink}
          >
            GITHUB REPOSITORY
          </a>
        </section>
      </div>
    </Modal>
  );
};
