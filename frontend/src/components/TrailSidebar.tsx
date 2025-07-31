import { useState, useEffect, useRef } from 'react';
import { MapBounds, User } from '../types';
import { CachedTrail } from '../services/trailCache';
import { PocketBaseService } from '../services/pocketbase';
import UserSection from './UserSection';

interface TrailSidebarProps {
  trails: CachedTrail[];
  visibleTrails: CachedTrail[];
  selectedTrail: CachedTrail | null;
  mapBounds: MapBounds | null;
  mapMoveEndTrigger: number;
  user: User | null;
  onTrailClick: (trail: CachedTrail) => void;
  onAddTrailClick: () => void;
  onAuthChange: (user: User | null) => void;
  onEditTrailClick: (trail: CachedTrail) => void;
}


// Get level color class
function getLevelClass(level: string): string {
  return `level-${level.toLowerCase()}`;
}

export default function TrailSidebar({ 
  trails, 
  visibleTrails, 
  selectedTrail,
  mapBounds: _, 
  mapMoveEndTrigger,
  user, 
  onTrailClick, 
  onAddTrailClick,
  onAuthChange,
  onEditTrailClick
}: TrailSidebarProps) {
  const [showQRCode, setShowQRCode] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

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

  // Auto-scroll to selected trail when map movement ends
  useEffect(() => {
    if (selectedTrail && trailRefs.current[selectedTrail.id]) {
      const trailElement = trailRefs.current[selectedTrail.id];
      
      if (trailElement) {
        // Small delay to ensure trails list is fully updated
        const scrollTimeout = setTimeout(() => {
          trailElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }, 400);
        
        return () => clearTimeout(scrollTimeout);
      }
    }
  }, [mapMoveEndTrigger]); // Only trigger on map move end

  return (
    <div className="sidebar">
      {/* Fixed Header Section */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '20px' }}>🤘 BikeMap</h2>
          {user && (user.role === 'Editor' || user.role === 'Admin') && (
            <button 
              className="btn btn-success" 
              onClick={onAddTrailClick}
              title="Add new trail"
              style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '8px 12px',
                fontSize: '12px'
              }}
            >
              ➕ Add Trail
            </button>
          )}
        </div>

        {/* User Section */}
        <UserSection 
          user={user}
          onAuthChange={onAuthChange}
        />

        <div style={{ marginBottom: '15px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
            Visible Trails ({visibleTrails.length})
          </h4>
        </div>
      </div>

      {/* Scrollable Trails Section */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
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
          <div style={{ paddingTop: '2px' }}>
            {(() => {
              // Sort trails to put selected trail first
              const sortedTrails = [...visibleTrails];
              if (selectedTrail) {
                const selectedIndex = sortedTrails.findIndex(t => t.id === selectedTrail.id);
                if (selectedIndex > 0) {
                  const [selected] = sortedTrails.splice(selectedIndex, 1);
                  sortedTrails.unshift(selected);
                }
              }
              return sortedTrails;
            })().map((trail) => {
              const isSelected = selectedTrail?.id === trail.id;
              // Get owner info - should now be a User object from cache
              const ownerInfo = typeof trail.owner === 'object' ? trail.owner : null;
              
              return (
                <div
                  key={trail.id}
                  ref={(el) => trailRefs.current[trail.id] = el}
                  onClick={() => onTrailClick(trail)}
                  title="Click to center on map"
                  style={{
                    background: isSelected 
                      ? 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)' 
                      : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                    border: isSelected 
                      ? '2px solid #007bff' 
                      : '1px solid #e9ecef',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: isSelected 
                      ? '0 4px 12px rgba(0,123,255,0.15)' 
                      : '0 2px 4px rgba(0,0,0,0.1)',
                    transform: isSelected ? 'translateY(-1px)' : 'none'
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  {/* Header section - always visible */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px'
                  }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#212529',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      marginRight: '8px'
                    }}>
                      {trail.name}
                    </h4>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexShrink: 0
                    }}>
                      <span 
                        className={getLevelClass(trail.level)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}
                      >
                        {trail.level}
                      </span>
                      {isSelected && (
                        <div style={{
                          width: '8px',
                          height: '8px',
                          backgroundColor: '#007bff',
                          borderRadius: '50%',
                          animation: 'pulse 2s infinite'
                        }}></div>
                      )}
                    </div>
                  </div>

                  {/* Tags - always visible, expand to show more */}
                  {trail.tags && trail.tags.length > 0 && (
                    <div style={{
                      marginBottom: '12px',
                      fontSize: '12px'
                    }}>
                      {isSelected ? 
                        trail.tags.map(tag => (
                          <span key={tag} style={{
                            background: '#e9ecef',
                            color: '#495057',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginRight: '4px',
                            display: 'inline-block',
                            marginBottom: '2px',
                            fontSize: '11px',
                            fontWeight: '500'
                          }}>
                            {tag}
                          </span>
                        )) :
                        (trail.tags.slice(0, 2).map(tag => (
                          <span key={tag} style={{
                            background: '#e9ecef',
                            color: '#495057',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginRight: '4px',
                            display: 'inline-block',
                            marginBottom: '2px',
                            fontSize: '11px',
                            fontWeight: '500'
                          }}>
                            {tag}
                          </span>
                        )).concat(
                          trail.tags.length > 2 ? [
                            <span key="more" style={{
                              color: '#6c757d',
                              fontSize: '11px',
                              fontStyle: 'italic'
                            }}>
                              +{trail.tags.length - 2} more
                            </span>
                          ] : []
                        ))
                      }
                    </div>
                  )}
                  
                  {/* Trail stats - always present with same styling */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '13px',
                    fontWeight: '500',
                    padding: '8px 12px',
                    background: 'rgba(0,0,0,0.03)',
                    borderRadius: '8px',
                    marginBottom: isSelected ? '16px' : '0'
                  }}>
                    {trail.elevation ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: '#dc3545', fontSize: '12px' }}>▲</span>
                          <span style={{ color: '#dc3545' }}>{Math.round(trail.elevation.gain)}m</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: '#28a745', fontSize: '12px' }}>▼</span>
                          <span style={{ color: '#28a745' }}>{Math.round(trail.elevation.loss)}m</span>
                        </div>
                      </>
                    ) : (
                      <span style={{ color: '#6c757d', fontSize: '12px' }}>📁 GPX available</span>
                    )}
                  </div>
                  
                  {/* Additional info when expanded */}
                  {isSelected && (
                    <div style={{ 
                      animation: 'fadeIn 0.3s ease-in-out',
                      transform: 'translateY(0)',
                      opacity: 1
                    }}>
                      {/* Metadata section */}
                      <div style={{
                        marginBottom: '16px',
                        padding: '12px',
                        background: 'rgba(0,123,255,0.05)',
                        borderRadius: '8px',
                        border: '1px solid rgba(0,123,255,0.1)'
                      }}>
                        <div style={{
                          marginBottom: '8px'
                        }}>
                          <span style={{ 
                            fontSize: '10px', 
                            color: '#6c757d',
                            textTransform: 'uppercase',
                            fontWeight: '600',
                            letterSpacing: '0.5px',
                            marginRight: '8px'
                          }}>Created:</span>
                          <span style={{ 
                            fontSize: '12px', 
                            color: '#212529',
                            fontWeight: '500'
                          }}>
                            {new Date(trail.created).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {ownerInfo && (
                          <div>
                            <span style={{ 
                              fontSize: '10px', 
                              color: '#6c757d',
                              textTransform: 'uppercase',
                              fontWeight: '600',
                              letterSpacing: '0.5px',
                              marginRight: '8px'
                            }}>Author:</span>
                            <span style={{ 
                              fontSize: '12px', 
                              color: '#212529',
                              fontWeight: '500',
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word'
                            }}>
                              {ownerInfo.name || ownerInfo.email || 'Unknown'}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Description */}
                      {trail.description && (
                        <>
                          <div style={{
                            fontSize: '10px',
                            color: '#6c757d',
                            textTransform: 'uppercase',
                            fontWeight: '600',
                            letterSpacing: '0.5px',
                            marginBottom: '6px'
                          }}>Description</div>
                          <div style={{ 
                            fontSize: '13px',
                            color: '#495057',
                            lineHeight: '1.5',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            whiteSpace: 'pre-wrap',
                            marginBottom: '16px'
                          }}>
                            {trail.description}
                          </div>
                        </>
                      )}
                      
                      {/* Action buttons */}
                      <div style={{ 
                        display: 'grid',
                        gridTemplateColumns: user && PocketBaseService.canEditTrail(trail, user) ? '1fr 1fr 1fr' : '1fr 1fr',
                        gap: '8px'
                      }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadGPX(trail);
                          }}
                          style={{ 
                            padding: '10px 12px',
                            background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(40,167,69,0.2)'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(40,167,69,0.3)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(40,167,69,0.2)';
                          }}
                        >
                          📥 GPX
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowQRCode(trail);
                          }}
                          style={{ 
                            padding: '10px 12px',
                            background: 'linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(111,66,193,0.2)'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(111,66,193,0.3)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(111,66,193,0.2)';
                          }}
                        >
                          📱 QR
                        </button>
                        
                        {/* Edit button for trail owners and admins */}
                        {user && PocketBaseService.canEditTrail(trail, user) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditTrailClick(trail);
                            }}
                            style={{ 
                              padding: '10px 12px',
                              background: 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)',
                              color: '#212529',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              transition: 'all 0.2s',
                              boxShadow: '0 2px 4px rgba(255,193,7,0.2)'
                            }}
                            title="Edit trail"
                            onMouseOver={(e) => {
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 8px rgba(255,193,7,0.3)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(255,193,7,0.2)';
                            }}
                          >
                            ✏️ Edit
                          </button>
                        )}
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
          zIndex: 2000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%)',
              color: 'white',
              padding: '20px 24px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📱</div>
              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                QR Code Download
              </h4>
            </div>
            
            {/* Content */}
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{
                background: 'white',
                padding: '16px',
                borderRadius: '12px',
                display: 'inline-block',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(showQRCode)}`}
                  alt="QR Code"
                  style={{ 
                    width: '200px', 
                    height: '200px', 
                    display: 'block',
                    borderRadius: '8px'
                  }}
                />
              </div>
              
              <p style={{ 
                fontSize: '14px', 
                color: '#6c757d', 
                marginBottom: '24px',
                lineHeight: '1.5'
              }}>
                Scan this QR code with your phone camera to download the GPX file directly to your device.
              </p>
              
              <button 
                onClick={() => setShowQRCode(null)}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  background: 'linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(111,66,193,0.2)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(111,66,193,0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(111,66,193,0.2)';
                }}
              >
                ✓ Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Information Modal */}
      {showInfoModal && (
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
          zIndex: 2000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
              color: 'white',
              padding: '20px 24px',
              borderRadius: '16px 16px 0 0',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🤘</div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                About BikeMap
              </h3>
            </div>
            
            {/* Content */}
            <div style={{ padding: '24px' }}>
              {/* App Description */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ 
                  margin: '0 0 12px 0', 
                  fontSize: '16px', 
                  fontWeight: '600',
                  color: '#212529'
                }}>
                  🚵 Mountain Bike Trail Sharing
                </h4>
                <p style={{ 
                  margin: '0 0 16px 0', 
                  fontSize: '14px', 
                  lineHeight: '1.5',
                  color: '#495057'
                }}>
                  BikeMap is a community-driven platform for sharing and discovering mountain bike trails. 
                  Upload your favorite trails, explore new routes, and connect with fellow riders.
                </p>
              </div>

              {/* Difficulty Levels */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ 
                  margin: '0 0 12px 0', 
                  fontSize: '16px', 
                  fontWeight: '600',
                  color: '#212529'
                }}>
                  🎯 Difficulty Levels
                </h4>
                <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="level-s0" style={{ marginRight: '8px', fontSize: '11px' }}>S0</span>
                      <span style={{ color: '#212529', fontWeight: '600' }}>Green - Easy</span>
                    </div>
                    <p style={{ margin: '0 0 0 32px', color: '#495057', fontSize: '11px', lineHeight: '1.4' }}>
                      Flat trails through forests or meadows on natural adherent surfaces or flat rock. No steps, rocks, or many roots. Gentle gradient, wide turns. No specific technique required.
                    </p>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="level-s1" style={{ marginRight: '8px', fontSize: '11px' }}>S1</span>
                      <span style={{ color: '#212529', fontWeight: '600' }}>Blue - Easy</span>
                    </div>
                    <p style={{ margin: '0 0 0 32px', color: '#495057', fontSize: '11px', lineHeight: '1.4' }}>
                      Small obstacles like flat roots, small stones, water channels. Partly unstable ground. Gradients up to 40%. No hairpin turns. Basic MTB knowledge needed: braking technique and good body balance.
                    </p>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="level-s2" style={{ marginRight: '8px', fontSize: '11px' }}>S2</span>
                      <span style={{ color: '#212529', fontWeight: '600' }}>Orange - Intermediate</span>
                    </div>
                    <p style={{ margin: '0 0 0 32px', color: '#495057', fontSize: '11px', lineHeight: '1.4' }}>
                      Larger roots, stones, steps, and tight turns. Gradients up to 70%. Required: braking technique and body weight transfer to overcome obstacles.
                    </p>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="level-s3" style={{ marginRight: '8px', fontSize: '11px' }}>S3</span>
                      <span style={{ color: '#212529', fontWeight: '600' }}>Red - Advanced</span>
                    </div>
                    <p style={{ margin: '0 0 0 32px', color: '#495057', fontSize: '11px', lineHeight: '1.4' }}>
                      Path obstructed by rocks, roots, large steps. Rocky and slippery terrain, hairpin turns and stairs. Gradient over 70%. Very good MTB mastery required: precise braking and excellent balance.
                    </p>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="level-s4" style={{ marginRight: '8px', fontSize: '11px' }}>S4</span>
                      <span style={{ color: '#212529', fontWeight: '600' }}>Purple - Expert</span>
                    </div>
                    <p style={{ margin: '0 0 0 32px', color: '#495057', fontSize: '11px', lineHeight: '1.4' }}>
                      Very steep and heavily obstructed terrain. Steep sections, tight hairpin turns, large steps. Trial techniques, front and rear wheel pivots, perfect braking essential. Only for extreme mountain bikers! Bike can hardly be pushed/carried.
                    </p>
                  </div>
                  
                  <div style={{ marginBottom: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="level-s5" style={{ marginRight: '8px', fontSize: '11px' }}>S5</span>
                      <span style={{ color: '#212529', fontWeight: '600' }}>Black - Extreme</span>
                    </div>
                    <p style={{ margin: '0 0 0 32px', color: '#495057', fontSize: '11px', lineHeight: '1.4' }}>
                      Very heavily obstructed terrain with large climbs. Loose terrain with scree/large obstacles like tree trunks and consecutive high steps. Little momentum, short braking distance. Reserved only for extreme mountain bikers! Bike can hardly be pushed/carried.
                    </p>
                  </div>
                </div>
              </div>

              {/* Trail Segments Preference */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ 
                  margin: '0 0 12px 0', 
                  fontSize: '16px', 
                  fontWeight: '600',
                  color: '#212529'
                }}>
                  🛤️ Trail Segments vs Tours
                </h4>
                <p style={{ 
                  margin: 0, 
                  fontSize: '14px', 
                  lineHeight: '1.5',
                  color: '#495057'
                }}>
                  We prefer individual trail segments over complete tours. This allows riders to mix and match 
                  trails based on their skill level and preferences, creating custom riding experiences.
                </p>
              </div>

              {/* GitHub Link */}
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ 
                  margin: '0 0 12px 0', 
                  fontSize: '16px', 
                  fontWeight: '600',
                  color: '#212529'
                }}>
                  💻 Open Source
                </h4>
                <p style={{ 
                  margin: '0 0 12px 0', 
                  fontSize: '14px', 
                  lineHeight: '1.5',
                  color: '#495057'
                }}>
                  BikeMap is open source! Check out the code, contribute, or report issues:
                </p>
                <a 
                  href="https://github.com/MartinMeyer1/bike-map" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    background: 'linear-gradient(135deg, #24292e 0%, #586069 100%)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(36,41,46,0.2)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(36,41,46,0.3)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(36,41,46,0.2)';
                  }}
                >
                  📂 GitHub Repository
                </a>
              </div>

              {/* Close Button */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                <button 
                  onClick={() => setShowInfoModal(false)}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(0,123,255,0.2)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,123,255,0.3)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,123,255,0.2)';
                  }}
                >
                  ✓ Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Footer Section */}
      <div style={{ flexShrink: 0, marginTop: '15px' }}>
        <div style={{ 
          padding: '10px', 
          background: '#f8f9fa', 
          borderRadius: '4px', 
          fontSize: '12px',
          color: '#666',
          position: 'relative'
        }}>
          <div style={{ marginBottom: '6px' }}>
            <strong>Difficulty Legend:</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            <span className="level-s0">S0</span>
            <span className="level-s1">S1</span>
            <span className="level-s2">S2</span>
            <span className="level-s3">S3</span>
            <span className="level-s4">S4</span>
            <span className="level-s5">S5</span>
          </div>
          <button
            onClick={() => setShowInfoModal(true)}
            style={{
              position: 'absolute',
              top: '50%',
              right: '10px',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              width: '32px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#6c757d',
              transition: 'all 0.2s'
            }}
            title="App Information"
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#e9ecef';
              e.currentTarget.style.borderColor = '#adb5bd';
              e.currentTarget.style.color = '#495057';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#dee2e6';
              e.currentTarget.style.color = '#6c757d';
            }}
          >
            ℹ️
          </button>
        </div>
      </div>
    </div>
  );
}