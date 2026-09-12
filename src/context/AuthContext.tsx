import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserPermissions } from '../types';
import { api, getStoredToken, setStoredToken, getStoredUser, setStoredUser } from '../api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (loginId: string, pass: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permissionKey: keyof UserPermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(() => !getStoredUser() && !!getStoredToken());

  const checkAuth = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setStoredUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.getCurrentUser();
      setUser(res.user);
      setStoredUser(res.user);
    } catch (err: any) {
      if (err.message && (err.message.includes('Token tapılmadı') || err.message.includes('Sessiyanın vaxtı bitib') || err.message.includes('etibarsızdır'))) {
        setUser(null);
        setStoredUser(null);
        setStoredToken(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    const handleUnauthorized = () => {
      setUser(null);
      setStoredUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (loginId: string, pass: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.login(loginId, pass);
      setStoredToken(res.token);
      setStoredUser(res.user);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.warn('Logout error ignored:', err);
    } finally {
      setStoredToken(null);
      setStoredUser(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await api.getCurrentUser();
      setUser(res.user);
    } catch (err) {
      console.error('Refresh user error:', err);
    }
  };

  const hasPermission = (permissionKey: keyof UserPermissions): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    if (!user.permissions) return false;
    return !!user.permissions[permissionKey];
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
