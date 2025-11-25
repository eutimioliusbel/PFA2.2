/**
 * Authentication Context
 *
 * Provides authentication state and methods throughout the app.
 * Manages JWT tokens, user sessions, and login/logout flows.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient, ApiUser } from '../services/apiClient';

interface AuthContextType {
  user: ApiUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  currentOrganizationId: string | null;
  setCurrentOrganizationId: (orgId: string) => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedUser = apiClient.getUser();
      const token = apiClient.getToken();

      if (storedUser && token) {
        // Verify token is still valid
        const { valid, user: verifiedUser } = await apiClient.verifyToken();

        if (valid && verifiedUser) {
          setUser(verifiedUser);

          // Set default organization (first one or stored preference)
          const storedOrgId = localStorage.getItem('pfa_current_org_id');
          if (storedOrgId && verifiedUser.organizations.some(o => o.id === storedOrgId)) {
            setCurrentOrganizationId(storedOrgId);
          } else if (verifiedUser.organizations.length > 0) {
            const defaultOrgId = verifiedUser.organizations[0].id;
            setCurrentOrganizationId(defaultOrgId);
            localStorage.setItem('pfa_current_org_id', defaultOrgId);
          }
        } else {
          // Token invalid, clear storage
          apiClient.removeToken();
          setUser(null);
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await apiClient.login(username, password);

      setUser(response.user);

      // Set default organization
      if (response.user.organizations.length > 0) {
        const defaultOrgId = response.user.organizations[0].id;
        setCurrentOrganizationId(defaultOrgId);
        localStorage.setItem('pfa_current_org_id', defaultOrgId);
      }

      setIsLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  };

  const logout = (): void => {
    apiClient.logout();
    setUser(null);
    setCurrentOrganizationId(null);
    localStorage.removeItem('pfa_current_org_id');
  };

  const updateCurrentOrganizationId = (orgId: string): void => {
    if (user && user.organizations.some(o => o.id === orgId)) {
      setCurrentOrganizationId(orgId);
      localStorage.setItem('pfa_current_org_id', orgId);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    currentOrganizationId,
    setCurrentOrganizationId: updateCurrentOrganizationId,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
