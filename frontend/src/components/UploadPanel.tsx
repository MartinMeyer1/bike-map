import React, { useState } from 'react';
import { Trail } from '../types';
import { PocketBaseService } from '../services/pocketbase';

interface UploadPanelProps {
  isVisible: boolean;
  onClose: () => void;
  onTrailCreated: (trail: Trail) => void;
  onStartDrawing?: () => void;
  drawnGpxContent?: string;
}

const DIFFICULTY_LEVELS = [
  { value: 'S0', label: 'S0 (Green - Easy)' },
  { value: 'S1', label: 'S1 (Blue - Easy)' },
  { value: 'S2', label: 'S2 (Orange - Intermediate)' },
  { value: 'S3', label: 'S3 (Red - Advanced)' },
  { value: 'S4', label: 'S4 (Purple - Expert)' },
  { value: 'S5', label: 'S5 (Black - Extreme)' },
];

const AVAILABLE_TAGS = [
  'Flow', 'Tech', 'Steep', 'Fast', 'Rocks', 'Roots', 'Jump', 'Drop', 'Bermed', 'Natural', "Switchbacks", "Loose", "Sketchy"
];

export default function UploadPanel({ isVisible, onClose, onTrailCreated, onStartDrawing, drawnGpxContent }: UploadPanelProps) {
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
      setError('You must be logged in to create a trail. Please log in first.');
      return;
    }

    if (onStartDrawing) {
      onStartDrawing();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check authentication first
    if (!PocketBaseService.isAuthenticated()) {
      setError('You must be logged in to create a trail. Please log in first.');
      return;
    }
    
    if (!formData.file && !drawnGpxContent) {
      setError('Please select a GPX file or draw a route');
      return;
    }

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
      
      // Get the authenticated user ID
      const currentUser = PocketBaseService.getCurrentUser();
      if (currentUser) {
        submitData.append('owner', currentUser.id);
      }

      const trail = await PocketBaseService.createTrail(submitData);
      
      onTrailCreated(trail);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        level: 'S1',
        tags: [],
        file: null,
      });
      
      // Reset file input
      const fileInput = document.getElementById('gpx-file') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
      // Close panel immediately
      onClose();
      
    } catch (err: any) {
      console.error('Trail upload error:', err);
      
      // Check if user lost authentication during upload
      if (err.message.includes('Authentication required')) {
        setError('Session expired. Please log in again and try uploading your trail.');
      } else if (err.message.includes('permission')) {
        setError('You need Editor or Admin permissions to create trails. Please contact an administrator.');
      } else {
        setError(err.message || 'Failed to upload trail. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };


  if (!isVisible) {
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
            background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
            color: 'white',
            padding: '20px 24px',
            borderRadius: '16px 16px 0 0',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>➕ Add New Trail</h3>
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
          <label htmlFor="gpx-file">GPX File</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="file"
              id="gpx-file"
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
              Selected: {formData.file.name}
            </div>
          )}
          {drawnGpxContent && (
            <div style={{ fontSize: '12px', color: '#28a745', marginTop: '4px' }}>
              ✅ Route drawn successfully
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
                {drawnGpxContent ? 'Saving...' : 'Uploading...'}
              </>
            ) : (
              drawnGpxContent ? '💾 Save Trail' : '➕ Upload Trail'
            )}
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
    </>
  );
}