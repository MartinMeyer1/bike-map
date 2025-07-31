import { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { PocketBaseService } from '../services/pocketbase';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentUser = PocketBaseService.getCurrentUser();
    setUser(currentUser);
    setIsLoading(false);

    const unsubscribe = PocketBaseService.onAuthChange((newUser) => {
      setUser(newUser);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async () => {
    try {
      const newUser = await PocketBaseService.loginWithGoogle();
      setUser(newUser);
      return newUser;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    PocketBaseService.logout();
    setUser(null);
  }, []);

  return {
    user,
    isLoading,
    login,
    logout,
    isAuthenticated: !!user
  };
};