import React, { useState } from 'react';
import { Trail } from '../types';
import { PocketBaseService } from '../services/pocketbase';

interface UploadPanelProps {
  isVisible: boolean;
  onClose: () => void;
  onTrailCreated: (trail: Trail) => void;
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

export default function UploadPanel({ isVisible, onClose, onTrailCreated }: UploadPanelProps) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check authentication first
    if (!PocketBaseService.isAuthenticated()) {
      setError('You must be logged in to create a trail. Please log in first.');
      return;
    }
    
    if (!formData.file) {
      setError('Please select a GPX file');
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
      submitData.append('file', formData.file);
      
      // Get the authenticated user ID
      const currentUser = PocketBaseService.getCurrentUser();
      if (currentUser) {
        submitData.append('owner', currentUser.id);
      }

      const trail = await PocketBaseService.createTrail(submitData);
      
      setSuccess('Trail uploaded successfully! Processing elevation data...');
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
      
      // Close panel after a delay
      setTimeout(() => {
        onClose();
        setSuccess('');
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to upload trail');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      name: '',
      description: '',
      level: 'S1',
      tags: [],
      file: null,
    });
    setError('');
    setSuccess('');
    
    // Reset file input
    const fileInput = document.getElementById('gpx-file') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="upload-panel visible">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>Add New Trail</h3>
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
          <label htmlFor="gpx-file">GPX File *</label>
          <input
            type="file"
            id="gpx-file"
            accept=".gpx,application/gpx+xml"
            onChange={handleFileChange}
            required
          />
          {formData.file && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Selected: {formData.file.name}
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
                Uploading...
              </>
            ) : (
              'Upload Trail'
            )}
          </button>
          
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            Reset
          </button>
          
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}