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
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        border: '1px solid #dee2e6',
        borderRadius: '12px', 
        fontSize: '14px', 
        marginBottom: '20px',
        textAlign: 'center',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
          color: 'white',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
            Welcome to BikeMap!
          </div>
          <div style={{ fontSize: '12px', opacity: '0.9' }}>
            Sign in to upload and manage trails
          </div>
        </div>
        
        <div style={{ padding: '0 16px 16px 16px' }}>
          <button 
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
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
          >
            🔐 Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // Authenticated user section
  return (
    <>
      <div style={{ 
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', 
        border: '1px solid #dee2e6',
        borderRadius: '12px', 
        fontSize: '14px', 
        marginBottom: '20px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {/* Header section */}
        <div style={{
          background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
          color: 'white',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flex: 1,
            minWidth: 0
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#00ff88',
              borderRadius: '50%',
              flexShrink: 0,
              boxShadow: '0 0 6px rgba(0,255,136,0.6)'
            }}></div>
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
            <button
              onClick={() => setShowUsernameEdit(true)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                color: 'white',
                flexShrink: 0,
                transition: 'all 0.2s'
              }}
              title="Edit username"
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              }}
            >
              ✏️ Edit
            </button>
          </div>
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '4px',
              marginLeft: '8px',
              flexShrink: 0,
              borderRadius: '4px',
              transition: 'all 0.2s'
            }}
            title={isCollapsed ? 'Expand user section' : 'Collapse user section'}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>

        {/* Collapsible content */}
        {!isCollapsed && (
          <div style={{ padding: '16px' }}>
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{
                  fontSize: '12px',
                  color: '#6c757d',
                  textTransform: 'uppercase',
                  fontWeight: '600',
                  letterSpacing: '0.5px'
                }}>Role</span>
                <span style={{
                  background: user.role === 'Admin' ? '#dc3545' : user.role === 'Editor' ? '#fd7e14' : '#6c757d',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  {user.role || 'Viewer'}
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => {
                PocketBaseService.logout();
                onAuthChange(null);
              }}
              style={{ 
                width: '100%',
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }}
            >
              🚪 Sign Out
            </button>
          </div>
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