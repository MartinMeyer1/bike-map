import React from 'react';
import { MapBounds, User } from '../types';
import { CachedTrail } from '../services/trailCache';

interface TrailSidebarProps {
  trails: CachedTrail[];
  visibleTrails: CachedTrail[];
  selectedTrail: CachedTrail | null;
  mapBounds: MapBounds | null;
  user: User | null;
  onTrailClick: (trail: CachedTrail) => void;
  onAddTrailClick: () => void;
}


// Get level color class
function getLevelClass(level: string): string {
  return `level-${level.toLowerCase()}`;
}

export default function TrailSidebar({ 
  trails, 
  visibleTrails, 
  selectedTrail,
  mapBounds, 
  user, 
  onTrailClick, 
  onAddTrailClick 
}: TrailSidebarProps) {
  return (
    <div className="sidebar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>🤘 BikeMap</h2>
        {user && (
          <button className="btn" onClick={onAddTrailClick} title="Add new trail">
            ➕
          </button>
        )}
      </div>

      {/* Authentication Status */}
      <div style={{ 
        background: user ? '#d4edda' : '#fff3cd', 
        color: user ? '#155724' : '#856404',
        padding: '8px 12px', 
        borderRadius: '4px', 
        fontSize: '12px', 
        marginBottom: '15px',
        border: `1px solid ${user ? '#c3e6cb' : '#ffeaa7'}`
      }}>
        {user ? (
          <>✅ Logged in as <strong>{user.name || user.email}</strong></>
        ) : (
          <>⚠️ Not logged in - <em>Login required to upload trails</em></>
        )}
      </div>

      {!user && (
        <div style={{ 
          background: '#f8f9fa', 
          padding: '10px', 
          borderRadius: '4px', 
          fontSize: '14px', 
          marginBottom: '15px',
          border: '1px solid #dee2e6'
        }}>
          <strong>Welcome!</strong><br />
          Login to upload your own trails.
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
          Visible Trails ({visibleTrails.length})
        </h4>
        

        {visibleTrails.length === 0 ? (
          <div style={{ 
            padding: '15px', 
            textAlign: 'center', 
            color: '#666',
            fontSize: '14px',
            border: '1px dashed #dee2e6',
            borderRadius: '4px'
          }}>
            {trails.length === 0 ? 'No trails uploaded yet.' : 'No trails visible in current area.'}<br />
            {trails.length === 0 ? (user ? 'Upload the first trail!' : 'Login to add trails.') : 'Pan the map to explore more trails.'}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', paddingTop: '2px' }}>
            {visibleTrails.map((trail) => {
              const isSelected = selectedTrail?.id === trail.id;
              const ownerInfo = typeof trail.owner === 'object' ? trail.owner : null;
              
              return (
                <div
                  key={trail.id}
                  className={`trail-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => onTrailClick(trail)}
                  title="Click to center on map"
                >
                  <h4>{trail.name}</h4>
                  <div className="trail-meta">
                    <span className={getLevelClass(trail.level)}>
                      <strong>{trail.level}</strong>
                    </span>
                    {trail.tags && trail.tags.length > 0 && (
                      <span style={{ marginLeft: '8px' }}>
                        {isSelected ? 
                          trail.tags.join(', ') : 
                          `${trail.tags.slice(0, 2).join(', ')}${trail.tags.length > 2 ? '...' : ''}`
                        }
                      </span>
                    )}
                  </div>
                  
                  {/* Trail stats - always present with same styling */}
                  <div className="trail-stats">
                    {trail.elevation ? 
                      `D+: ${Math.round(trail.elevation.gain)}m | D-: ${Math.round(trail.elevation.loss)}m` : 
                      'GPX file available'
                    }
                  </div>
                  
                  {/* Additional info when expanded */}
                  {isSelected && (
                    <div className="trail-expanded">
                      {/* Creation date */}
                      <div style={{ margin: '4px 0', fontSize: '11px', color: '#666' }}>
                        <strong>Created:</strong> {new Date(trail.created).toLocaleDateString()}
                      </div>
                      
                      
                      {/* Description */}
                      {trail.description && (
                        <div style={{ 
                          margin: '8px 0 4px 0', 
                          fontSize: '12px',
                          color: '#666',
                          lineHeight: '1.4'
                        }}>
                          <strong>Description:</strong><br />
                          {trail.description}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Push legend to bottom with flex spacer */}
      <div style={{ flexGrow: 1 }}></div>

      <div style={{ 
        marginTop: '15px', 
        padding: '10px', 
        background: '#f8f9fa', 
        borderRadius: '4px', 
        fontSize: '12px',
        color: '#666'
      }}>
        <strong>Difficulty Legend:</strong><br />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
          <span className="level-s0">S0</span>
          <span className="level-s1">S1</span>
          <span className="level-s2">S2</span>
          <span className="level-s3">S3</span>
          <span className="level-s4">S4</span>
          <span className="level-s5">S5</span>
        </div>
      </div>
    </div>
  );
}