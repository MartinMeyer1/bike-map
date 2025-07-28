import React, { useState, useEffect } from 'react';
import { Trail } from '../types';
import { PocketBaseService } from '../services/pocketbase';

interface TrailEditPanelProps {
  isVisible: boolean;
  trail: Trail | null;
  onClose: () => void;
  onTrailUpdated: (trail: Trail) => void;
  onTrailDeleted: (trailId: string) => void;
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
  'Flow', 'Tech', 'Steep', 'Fast', 'Rocks', 'Roots', 'Jump', 'Drop', 'Bermed', 'Natural'
];

export default function TrailEditPanel({ 
  isVisible, 
  trail, 
  onClose, 
  onTrailUpdated, 
  onTrailDeleted 
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
      
      // Only append file if a new one was selected
      if (formData.file) {
        submitData.append('file', formData.file);
      }

      const updatedTrail = await PocketBaseService.updateTrail(trail.id, submitData);
      
      setSuccess('Trail updated successfully!');
      onTrailUpdated(updatedTrail);
      
      // Close panel after a delay
      setTimeout(() => {
        onClose();
        setSuccess('');
      }, 1500);
      
    } catch (err: any) {
      setError(err.message || 'Failed to update trail');
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
    } catch (err: any) {
      setError(err.message || 'Failed to delete trail');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReset = () => {
    if (trail) {
      setFormData({
        name: trail.name,
        description: trail.description || '',
        level: trail.level,
        tags: trail.tags || [],
        file: null,
      });
    }
    setError('');
    setSuccess('');
    
    // Reset file input
    const fileInput = document.getElementById('edit-gpx-file') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  if (!isVisible || !trail) {
    return null;
  }

  return (
    <>
      <div className="upload-panel visible">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>Edit Trail</h3>
          <button 
            type="button" 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '20px', 
              cursor: 'pointer',
              padding: '0 5px'
            }}
          >
            ×
          </button>
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="edit-gpx-file">GPX File (optional - leave empty to keep current file)</label>
            <input
              type="file"
              id="edit-gpx-file"
              accept=".gpx,application/gpx+xml"
              onChange={handleFileChange}
            />
            {formData.file && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                New file selected: {formData.file.name}
              </div>
            )}
            {!formData.file && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Current file: {trail?.file || 'Unknown'}
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

          <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
            <button type="submit" className="btn btn-success" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="loading"></span>
                  Updating...
                </>
              ) : (
                'Update Trail'
              )}
            </button>
            
            <button 
              type="button" 
              className="btn btn-danger" 
              onClick={() => setShowDeleteConfirm(true)}
              style={{ marginLeft: 'auto' }}
            >
              🗑️ Delete
            </button>
            
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
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
          zIndex: 3000
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'center',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#dc3545' }}>
              🗑️ Delete Trail
            </h4>
            <p style={{ margin: '0 0 20px 0', color: '#666' }}>
              Are you sure you want to delete "<strong>{trail.name}</strong>"?
              <br />
              <span style={{ fontSize: '14px', color: '#999' }}>
                This action cannot be undone.
              </span>
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={isDeleting}
                style={{ minWidth: '80px' }}
              >
                {isDeleting ? (
                  <>
                    <span className="loading"></span>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}