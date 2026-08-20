import React from 'react';
import { Modal } from './ui';
import {
  BASE_MAPS,
  BASE_MAP_GROUPS,
  BASE_MAP_IDS,
  BaseMapGroup,
  BaseMapId,
} from '../map/basemaps';
import styles from './BaseMapModal.module.css';

interface BaseMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBaseMap: BaseMapId;
  onSelect: (id: BaseMapId) => void;
}

function idsInGroup(group: BaseMapGroup): BaseMapId[] {
  return BASE_MAP_IDS.filter((id) => BASE_MAPS[id].group === group);
}

/**
 * The base map picker.
 *
 * A modal rather than the button's old binary flip: six maps do not toggle. One
 * section per provider, the same three forms across each, so the buttons carry
 * only what varies between them -- and the one in use is filled with ink rather
 * than marked beside.
 */
export const BaseMapModal: React.FC<BaseMapModalProps> = ({
  isOpen,
  onClose,
  activeBaseMap,
  onSelect,
}) => {
  const choose = (id: BaseMapId) => {
    onSelect(id);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="narrow" title="Base map">
      <div className={styles.groups}>
        {BASE_MAP_GROUPS.map((group) => (
          <section key={group}>
            <h4 className={styles.heading}>{group.toUpperCase()}</h4>

            <div className={styles.options}>
              {idsInGroup(group).map((id) => {
                const isActive = id === activeBaseMap;

                return (
                  <button
                    key={id}
                    type="button"
                    className={[styles.option, isActive ? styles.active : '']
                      .filter(Boolean)
                      .join(' ')}
                    aria-pressed={isActive}
                    onClick={() => choose(id)}
                  >
                    {BASE_MAPS[id].variant}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
};
