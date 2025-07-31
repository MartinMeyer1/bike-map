import { useState } from 'react';
import { User } from '../types';
import { PocketBaseService } from '../services/pocketbase';
import { getErrorMessage } from '../utils/errorHandling';

interface AuthPanelProps {
  user: User | null;
  onAuthChange: (user: User | null) => void;
}

export default function AuthPanel({ user, onAuthChange }: AuthPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      const user = await PocketBaseService.loginWithGoogle();
      onAuthChange(user);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    PocketBaseService.logout();
    onAuthChange(null);
  };

  if (user) {
    return (
      <div className="auth-panel">
        <h3>Welcome, {user.name || user.email}!</h3>
        <p>Logged in as: {user.email}</p>
        <button className="btn btn-secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="auth-panel">
      <h3>Sign in to BikeMap</h3>
      
      {error && <div className="error">{error}</div>}
      
      <div style={{ textAlign: 'center' }}>
        <p style={{ marginBottom: '15px', color: '#666', fontSize: '14px' }}>
          Login required to upload trails
        </p>
        
        <button 
          className="btn btn-success" 
          onClick={handleGoogleLogin}
          disabled={isLoading}
          style={{ 
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px'
          }}
        >
          {isLoading ? (
            <>
              <span className="loading"></span>
              Signing in...
            </>
          ) : (
            <>
              🔐 Sign in with Google
            </>
          )}
        </button>
        
        <p style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
          We only use your Google account for authentication.<br />
          Your email address remains private.
        </p>
      </div>
    </div>
  );
}