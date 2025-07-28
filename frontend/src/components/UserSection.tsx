import React, { useState } from 'react';
import { User } from '../types';
import { PocketBaseService } from '../services/pocketbase';
import UsernameEditModal from './UsernameEditModal';

interface UserSectionProps {
  user: User | null;
  onAuthChange: (user: User | null) => void;
}

export default function UserSection({ user, onAuthChange }: UserSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUsernameEdit, setShowUsernameEdit] = useState(false);

  const handleUserUpdated = (updatedUser: User) => {
    onAuthChange(updatedUser);
  };

  if (!user) {
    // Guest user - show login button
    return (
      <div style={{ 
        background: '#f8f9fa', 
        color: '#333',
        padding: '15px', 
        borderRadius: '8px', 
        fontSize: '14px', 
        marginBottom: '20px',
        border: '1px solid #dee2e6',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '12px' }}>
          <strong>Welcome to BikeMap!</strong><br />
          <span style={{ fontSize: '12px', color: '#666' }}>
            Sign in to upload and manage trails
          </span>
        </div>
        
        <button 
          className="btn btn-success"
          onClick={async () => {
            try {
              const user = await PocketBaseService.loginWithGoogle();
              onAuthChange(user);
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
            padding: '12px 16px',
            fontSize: '14px'
          }}
        >
          🔐 Sign in with Google
        </button>
      </div>
    );
  }

  // Authenticated user section
  return (
    <>
      <div style={{ 
        background: '#d4edda', 
        color: '#155724',
        padding: '15px', 
        borderRadius: '8px', 
        fontSize: '14px', 
        marginBottom: '20px',
        border: '1px solid #c3e6cb'
      }}>
        {/* Collapse toggle - top left */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
          marginBottom: '8px'
        }}>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: 'none',
              border: 'none',
              color: '#155724',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '2px',
              margin: 0
            }}
            title={isCollapsed ? 'Expand user section' : 'Collapse user section'}
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>

        {/* User info */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          marginBottom: isCollapsed ? '0' : '12px'
        }}>
          <span style={{ flexShrink: 0 }}>✅</span>
          <strong style={{ 
            fontSize: '15px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: 1
          }}>
            {user.name || user.email}
          </strong>
          {!isCollapsed && (
            <button
              onClick={() => setShowUsernameEdit(true)}
              style={{
                background: 'rgba(255,255,255,0.8)',
                border: '1px solid #c3e6cb',
                borderRadius: '3px',
                padding: '2px 6px',
                fontSize: '10px',
                cursor: 'pointer',
                color: '#155724',
                flexShrink: 0
              }}
              title="Edit username"
            >
              ✏️
            </button>
          )}
        </div>

        {/* Collapsible content */}
        {!isCollapsed && (
          <>
            <div style={{ 
              fontSize: '12px', 
              color: '#0f5132', 
              marginBottom: '12px',
              paddingLeft: '20px'
            }}>
              Role: <strong>{user.role || 'Viewer'}</strong>
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              justifyContent: 'flex-start'
            }}>
              <button 
                className="btn" 
                onClick={() => {
                  PocketBaseService.logout();
                  onAuthChange(null);
                }}
                style={{ 
                  fontSize: '11px', 
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.8)',
                  color: '#155724',
                  border: '1px solid #c3e6cb'
                }}
              >
                🚪 Logout
              </button>
            </div>
          </>
        )}
      </div>

      {/* Username edit modal */}
      <UsernameEditModal
        isVisible={showUsernameEdit}
        user={user}
        onClose={() => setShowUsernameEdit(false)}
        onUserUpdated={handleUserUpdated}
      />
    </>
  );
}