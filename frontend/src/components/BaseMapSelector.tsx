import React from 'react';
import styles from './mapControls.module.css';

export type BaseMapType = 'swisstopo' | 'osm';

interface BaseMapSelectorProps {
  activeBaseMap: BaseMapType;
  onToggle: () => void;
}

export const BaseMapSelector: React.FC<BaseMapSelectorProps> = ({ activeBaseMap, onToggle }) => {
  return (
    <div className={`${styles.controls} ${styles.basemapControls}`}>
      <button
        className={styles.controlButton}
        onClick={onToggle}
        title={activeBaseMap === 'swisstopo' ? 'Switch to OpenStreetMap' : 'Switch to Swisstopo'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </button>

    </div>
  );
};
