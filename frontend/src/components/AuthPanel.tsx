import React, { useState } from 'react';
import { User } from '../types';
import { PocketBaseService } from '../services/pocketbase';

interface AuthPanelProps {
  user: User | null;
  onAuthChange: (user: User | null) => void;
}

export default function AuthPanel({ user, onAuthChange }: AuthPanelProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let user: User;
      if (isLogin) {
        user = await PocketBaseService.login(email, password);
      } else {
        user = await PocketBaseService.register(email, password, name);
      }
      
      onAuthChange(user);
      
      // Reset form
      setEmail('');
      setPassword('');
      setName('');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
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
      <h3>{isLogin ? 'Login' : 'Register'}</h3>
      
      {error && <div className="error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <div className="form-group">
            <label htmlFor="name">Name (optional)</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password (min 8 chars)"
            minLength={8}
          />
        </div>
        
        <button type="submit" className="btn" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="loading"></span>
              {isLogin ? 'Logging in...' : 'Registering...'}
            </>
          ) : (
            isLogin ? 'Login' : 'Register'
          )}
        </button>
      </form>
      
      <p style={{ marginTop: '12px', fontSize: '14px' }}>
        {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button
          type="button"
          style={{ 
            background: 'none', 
            border: 'none', 
            color: '#007bff', 
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0,
            fontSize: '14px'
          }}
          onClick={() => {
            setIsLogin(!isLogin);
            setError('');
          }}
        >
          {isLogin ? 'Register here' : 'Login here'}
        </button>
      </p>
    </div>
  );
}