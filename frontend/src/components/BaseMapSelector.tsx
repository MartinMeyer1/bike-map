import React from 'react';

export type BaseMapType = 'swisstopo' | 'osm';

interface BaseMapSelectorProps {
  activeBaseMap: BaseMapType;
  onToggle: () => void;
}

export const BaseMapSelector: React.FC<BaseMapSelectorProps> = ({ activeBaseMap, onToggle }) => {
  return (
    <div className="basemap-controls">
      <button
        className="basemap-button"
        onClick={onToggle}
        title={activeBaseMap === 'swisstopo' ? 'Switch to OpenStreetMap' : 'Switch to Swisstopo'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </button>

      <style>{`
        .basemap-controls {
          position: fixed;
          top: 80px;
          right: 20px;
          z-index: 1000;
        }

        .basemap-button {
          width: 48px;
          height: 48px;
          background: white;
          border: 2px solid #007AFF;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }

        .basemap-button:hover {
          background: #f0f8ff;
          transform: scale(1.05);
        }

        @media (max-width: 768px) {
          .basemap-controls {
            top: 114px;
            right: 16px;
          }

          .basemap-button {
            width: 44px;
            height: 44px;
          }
        }
      `}</style>
    </div>
  );
};
