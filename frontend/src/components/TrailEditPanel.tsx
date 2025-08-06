import React, { useState, useEffect } from 'react';
import { Trail } from '../types';
import { PocketBaseService } from '../services/pocketbase';
import { DIFFICULTY_LEVELS, AVAILABLE_TAGS } from '../utils/constants';
import { handleApiError } from '../utils/errorHandling';

interface TrailEditPanelProps {
  isVisible: boolean;
  trail: Trail | null;
  onClose: () => void;
  onTrailUpdated: (trail: Trail) => void;
  onTrailDeleted: (trailId: string) => void;
  onStartDrawing?: () => void;
  drawnGpxContent?: string;
}


export default function TrailEditPanel({ 
  isVisible, 
  trail, 
  onClose, 
  onTrailUpdated, 
  onTrailDeleted,
  onStartDrawing,
  drawnGpxContent
}: TrailEditPanelProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: 'S1' as Trail['level'],
    tags: [] as string[],
    file: null as File | null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Update form data when trail changes
  useEffect(() => {
    if (trail) {
      setFormData({
        name: trail.name,
        description: trail.description || '',
        level: trail.level,
        tags: trail.tags || [],
        file: null, // Reset file when editing different trail
      });
    }
  }, [trail]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.gpx')) {
        setError('Please select a GPX file');
        return;
      }
      setFormData(prev => ({
        ...prev,
        file,
      }));
      setError('');
    }
  };

  const handleTagChange = (tag: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      tags: checked 
        ? [...prev.tags, tag]
        : prev.tags.filter(t => t !== tag),
    }));
  };

  const handleStartDrawing = () => {
    if (!PocketBaseService.isAuthenticated()) {
      setError('You must be logged in to edit a trail. Please log in first.');
      return;
    }

    if (onStartDrawing) {
      onStartDrawing();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!trail) return;

    if (!formData.name.trim()) {
      setError('Please enter a trail name');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const submitData = new FormData();
      submitData.append('name', formData.name.trim());
      submitData.append('description', formData.description.trim());
      submitData.append('level', formData.level);
      submitData.append('tags', JSON.stringify(formData.tags));
      
      // Handle file upload: either new file or drawn GPX content
      if (formData.file) {
        submitData.append('file', formData.file);
      } else if (drawnGpxContent) {
        // Create a Blob from the GPX content for upload
        const gpxBlob = new Blob([drawnGpxContent], { type: 'application/gpx+xml' });
        const gpxFile = new File([gpxBlob], `${formData.name.trim().replace(/[^a-zA-Z0-9]/g, '_')}.gpx`, {
          type: 'application/gpx+xml'
        });
        submitData.append('file', gpxFile);
      }

      const updatedTrail = await PocketBaseService.updateTrail(trail.id, submitData);
      
      onTrailUpdated(updatedTrail);
      
      // Close panel immediately
      onClose();
      
    } catch (err: unknown) {
      console.error('Trail update error:', err);
      const appError = handleApiError(err);
      setError(appError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!trail) return;

    setIsDeleting(true);
    setError('');

    try {
      await PocketBaseService.deleteTrail(trail.id);
      onTrailDeleted(trail.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: unknown) {
      console.error('Trail delete error:', err);
      const appError = handleApiError(err);
      setError(appError.message);
    } finally {
      setIsDeleting(false);
    }
  };


  if (!isVisible || !trail) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
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
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)',
            color: '#212529',
            padding: '20px 24px',
            borderRadius: '16px 16px 0 0',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>✏️ Edit Trail</h3>
          </div>

          {/* Content */}
          <div style={{ padding: '24px' }}>

        {error && (
          <div style={{
            background: 'linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%)',
            color: '#721c24',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #f5c6cb',
            fontSize: '14px'
          }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{
            background: 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)',
            color: '#155724',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #c3e6cb',
            fontSize: '14px'
          }}>
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="edit-gpx-file">GPX File (optional - leave empty to keep current file)</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="file"
                id="edit-gpx-file"
                accept=".gpx,application/gpx+xml"
                onChange={handleFileChange}
                style={{ paddingRight: '85px', width: '100%' }}
              />
              <button
                type="button"
                onClick={handleStartDrawing}
                style={{
                  position: 'absolute',
                  right: '8px',
                  padding: '6px 12px',
                  background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  height: '28px',
                  zIndex: 1,
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
                🎯 Draw
              </button>
            </div>
            {formData.file && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                New file selected: {formData.file.name}
              </div>
            )}
            {drawnGpxContent && (
              <div style={{ fontSize: '12px', color: '#28a745', marginTop: '4px' }}>
                ✅ Route drawn successfully
              </div>
            )}
            {!formData.file && !drawnGpxContent && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Current file: {trail?.gpx_file || 'Unknown'}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="name">Trail Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              placeholder="e.g., Epic Singletrack"
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="level">Difficulty Level *</label>
            <select
              id="level"
              name="level"
              value={formData.level}
              onChange={handleInputChange}
              required
            >
              {DIFFICULTY_LEVELS.map(level => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Tags</label>
            <div className="checkbox-group">
              {AVAILABLE_TAGS.map(tag => (
                <label key={tag}>
                  <input
                    type="checkbox"
                    checked={formData.tags.includes(tag)}
                    onChange={(e) => handleTagChange(tag, e.target.checked)}
                  />
                  {tag}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Optional description of the trail..."
              maxLength={500}
              rows={3}
            />
            <div style={{ fontSize: '12px', color: '#666', textAlign: 'right' }}>
              {formData.description.length}/500 characters
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e9ecef' }}>
            <button 
              type="submit" 
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: isLoading ? '#6c757d' : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(40,167,69,0.2)'
              }}
              onMouseOver={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(40,167,69,0.3)';
                }
              }}
              onMouseOut={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(40,167,69,0.2)';
                }
              }}
            >
              {isLoading ? (
                <>
                  <span style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid transparent',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></span>
                  Updating...
                </>
              ) : (
                drawnGpxContent ? '💾 Save Trail Route' : '💾 Update Trail'
              )}
            </button>
            
            <button 
              type="button" 
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(220,53,69,0.2)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(220,53,69,0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(220,53,69,0.2)';
              }}
            >
              🗑️ Delete
            </button>
            
            <button 
              type="button" 
              onClick={onClose}
              style={{
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(108,117,125,0.2)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(108,117,125,0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(108,117,125,0.2)';
              }}
            >
              Cancel
            </button>
          </div>
        </form>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '450px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.2)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
              color: 'white',
              padding: '20px 24px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🗑️</div>
              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Delete Trail
              </h4>
            </div>
            
            {/* Content */}
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ 
                margin: '0 0 8px 0', 
                color: '#495057',
                fontSize: '16px',
                lineHeight: '1.5'
              }}>
                Are you sure you want to delete
              </p>
              <p style={{
                margin: '0 0 16px 0',
                color: '#212529',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                "{trail?.name}"?
              </p>
              <p style={{ 
                margin: '0 0 24px 0', 
                color: '#6c757d',
                fontSize: '14px',
                fontStyle: 'italic'
              }}>
                This action cannot be undone.
              </p>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  style={{ 
                    minWidth: '100px',
                    padding: '12px 20px',
                    background: isDeleting ? '#6c757d' : 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(220,53,69,0.2)'
                  }}
                  onMouseOver={(e) => {
                    if (!isDeleting) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(220,53,69,0.3)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isDeleting) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(220,53,69,0.2)';
                    }
                  }}
                >
                  {isDeleting ? (
                    <>
                      <span style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid transparent',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></span>
                      Deleting...
                    </>
                  ) : (
                    '🗑️ Delete'
                  )}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  style={{
                    minWidth: '100px',
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(108,117,125,0.2)'
                  }}
                  onMouseOver={(e) => {
                    if (!isDeleting) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(108,117,125,0.3)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isDeleting) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(108,117,125,0.2)';
                    }
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}