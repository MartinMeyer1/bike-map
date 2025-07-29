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
      zIndex: 2000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '450px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        border: '1px solid rgba(255,255,255,0.2)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)',
          color: '#212529',
          padding: '20px 24px',
          textAlign: 'center'
        }}>
          <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>✏️ Edit Username</h4>
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

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e9ecef' }}>
            <button 
              type="submit" 
              disabled={isLoading || !newName.trim()}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: (isLoading || !newName.trim()) ? '#6c757d' : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: (isLoading || !newName.trim()) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(40,167,69,0.2)'
              }}
              onMouseOver={(e) => {
                if (!isLoading && newName.trim()) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(40,167,69,0.3)';
                }
              }}
              onMouseOut={(e) => {
                if (!isLoading && newName.trim()) {
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
                  Saving...
                </>
              ) : (
                '✅ Save'
              )}
            </button>
            <button 
              type="button" 
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(108,117,125,0.2)'
              }}
              onMouseOver={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(108,117,125,0.3)';
                }
              }}
              onMouseOut={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(108,117,125,0.2)';
                }
              }}
            >
              Cancel
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}