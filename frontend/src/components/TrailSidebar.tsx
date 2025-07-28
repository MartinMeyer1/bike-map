import React, { useState } from 'react';
import { MapBounds, User } from '../types';
import { CachedTrail } from '../services/trailCache';
import { PocketBaseService } from '../services/pocketbase';

interface TrailSidebarProps {
  trails: CachedTrail[];
  visibleTrails: CachedTrail[];
  selectedTrail: CachedTrail | null;
  mapBounds: MapBounds | null;
  user: User | null;
  onTrailClick: (trail: CachedTrail) => void;
  onAddTrailClick: () => void;
  onAuthChange: (user: User | null) => void;
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
  onAddTrailClick,
  onAuthChange
}: TrailSidebarProps) {
  const [showQRCode, setShowQRCode] = useState<string | null>(null);

  const handleDownloadGPX = (trail: CachedTrail) => {
    const fileUrl = PocketBaseService.getTrailFileUrl(trail);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = `${trail.name}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShowQRCode = (trail: CachedTrail) => {
    const fileUrl = PocketBaseService.getTrailFileUrl(trail);
    setShowQRCode(fileUrl);
  };
  return (
    <div className="sidebar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>🤘 BikeMap</h2>
        {user && (user.role === 'Editor' || user.role === 'Admin') && (
          <button className="btn" onClick={onAddTrailClick} title="Add new trail">
            ➕
          </button>
        )}
      </div>


      {/* Authentication Status */}
      <div style={{ 
        background: user ? '#d4edda' : '#f8f9fa', 
        color: user ? '#155724' : '#333',
        padding: '10px', 
        borderRadius: '4px', 
        fontSize: '14px', 
        marginBottom: '15px',
        border: `1px solid ${user ? '#c3e6cb' : '#dee2e6'}`,
        textAlign: user ? 'left' : 'center'
      }}>
        {user ? (
          <div>
            <div style={{ marginBottom: '8px' }}>
              ✅ Logged in as <strong>{user.name || user.email}</strong> ({user.role || 'Viewer'})
            </div>
            <button 
              className="btn" 
              onClick={() => {
                PocketBaseService.logout();
                onAuthChange(null); // Update parent state
              }}
              style={{ 
                fontSize: '10px', 
                padding: '4px 8px',
                background: 'rgba(255,255,255,0.8)',
                color: '#155724',
                border: '1px solid #c3e6cb'
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Welcome!</strong><br />
              Only Editor/Admin users can upload trails.
            </div>
            
            <button 
              className="btn btn-success" 
              onClick={async () => {
                try {
                  const user = await PocketBaseService.loginWithGoogle();
                  onAuthChange(user); // Update parent state
                } catch (error) {
                  console.error('Login failed:', error);
                  alert('Login failed. Please try again.');
                }
              }}
              style={{ 
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px'
              }}
            >
              🔐 Sign in with Google
            </button>
          </div>
        )}
      </div>

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
              // Get owner info - should now be a User object from cache
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
                    {trail.elevation ? (
                      <>
                        <span style={{ color: '#dc3545' }}>D+ {Math.round(trail.elevation.gain)}m</span>
                        <span style={{ color: '#666' }}> | </span>
                        <span style={{ color: '#28a745' }}>D- {Math.round(trail.elevation.loss)}m</span>
                      </>
                    ) : (
                      'GPX file available'
                    )}
                  </div>
                  
                  {/* Additional info when expanded */}
                  {isSelected && (
                    <div className="trail-expanded">
                      {/* Creation date */}
                      <div style={{ margin: '4px 0', fontSize: '11px', color: '#666' }}>
                        <strong>Created:</strong> {new Date(trail.created).toLocaleDateString()}
                      </div>
                      
                      {/* Author info */}
                      {ownerInfo && ownerInfo.name && (
                        <div style={{ margin: '4px 0', fontSize: '11px', color: '#666' }}>
                          <strong>Author:</strong> {ownerInfo.name}
                        </div>
                      )}
                      
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
                      
                      {/* Action buttons */}
                      <div style={{ 
                        display: 'flex', 
                        gap: '8px', 
                        marginTop: '12px',
                        paddingTop: '8px',
                        borderTop: '1px solid #eee'
                      }}>
                        <button
                          className="btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadGPX(trail);
                          }}
                          style={{ 
                            fontSize: '11px', 
                            padding: '4px 8px',
                            flex: 1
                          }}
                        >
                          📥 Download GPX
                        </button>
                        <button
                          className="btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowQRCode(trail);
                          }}
                          style={{ 
                            fontSize: '11px', 
                            padding: '4px 8px',
                            flex: 1
                          }}
                        >
                          📱 QR Code
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQRCode && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'center',
            maxWidth: '300px'
          }}>
            <h4 style={{ margin: '0 0 15px 0' }}>Scan to Download GPX</h4>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(showQRCode)}`}
              alt="QR Code"
              style={{ width: '200px', height: '200px', margin: '0 0 15px 0' }}
            />
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
              Scan with your phone to download the GPX file
            </div>
            <button 
              className="btn"
              onClick={() => setShowQRCode(null)}
              style={{ width: '100%' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

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