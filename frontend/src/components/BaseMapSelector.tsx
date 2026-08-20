import React, { useState } from 'react';
import { BaseMapId } from '../map/basemaps';
import { BaseMapModal } from './BaseMapModal';
import styles from './mapControls.module.css';

interface BaseMapSelectorProps {
  activeBaseMap: BaseMapId;
  onSelect: (id: BaseMapId) => void;
}

export const BaseMapSelector: React.FC<BaseMapSelectorProps> = ({ activeBaseMap, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    /*
     * The dialog is a sibling of the control, not a child of it. `.controls`
     * carries a z-index of its own and, on mobile, an opacity that fades with
     * the sheet -- both of which make it a stacking context, and a dialog
     * inside one is stuck underneath the panels it is supposed to cover.
     */
    <>
      <div className={`${styles.controls} ${styles.basemapControls}`}>
        <button
          className={styles.controlButton}
          onClick={() => setIsOpen(true)}
          title="Base map"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          {/* currentColor, so the button's own state decides the ink. */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </button>
      </div>

      <BaseMapModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        activeBaseMap={activeBaseMap}
        onSelect={onSelect}
      />
    </>
  );
};
