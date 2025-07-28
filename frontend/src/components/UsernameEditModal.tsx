import React, { useState } from 'react';
import { User } from '../types';
import { PocketBaseService } from '../services/pocketbase';

interface UsernameEditModalProps {
  isVisible: boolean;
  user: User;
  onClose: () => void;
  onUserUpdated: (user: User) => void;
}

export default function UsernameEditModal({ 
  isVisible, 
  user, 
  onClose, 
  onUserUpdated 
}: UsernameEditModalProps) {
  const [newName, setNewName] = useState(user.name || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newName.trim()) {
      setError('Please enter a username');
      return;
    }

    if (newName.trim() === user.name) {
      onClose();
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const updatedUser = await PocketBaseService.updateUser(user.id, { 
        name: newName.trim() 
      });
      
      onUserUpdated(updatedUser);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update username');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setNewName(user.name || '');
    setError('');
  };

  if (!isVisible) {
    return null;
  }

  return (
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
        padding: '25px',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '400px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <h4 style={{ margin: 0 }}>✏️ Edit Username</h4>
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

        {error && (
          <div style={{
            background: '#f8d7da',
            color: '#721c24',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '15px',
            border: '1px solid #f5c6cb'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label 
              htmlFor="username" 
              style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: 'bold' 
              }}
            >
              Username
            </label>
            <input
              type="text"
              id="username"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter your display name"
              maxLength={50}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
              autoFocus
            />
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              textAlign: 'right',
              marginTop: '4px'
            }}>
              {newName.length}/50 characters
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button 
              type="submit" 
              className="btn btn-success"
              disabled={isLoading || !newName.trim()}
            >
              {isLoading ? (
                <>
                  <span className="loading"></span>
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
            <button 
              type="button" 
              className="btn"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}