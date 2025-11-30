/**
 * Authentication Context
 *
 * Provides authentication state and methods throughout the app.
 * Manages JWT tokens, user sessions, and login/logout flows.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { apiClient, ApiUser, JWTPayload } from '../services/apiClient';
import type { ScreenKey, ScreenPermissions, PermissionKey } from '../types';

interface AuthContextType {
  user: ApiUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  currentOrganizationId: string | null;
  setCurrentOrganizationId: (orgId: string) => void;
  error: string | null;
  screenAccess: ScreenPermissions;
  canAccessScreen: (screen: ScreenKey) => boolean;
  hasPermission: (permission: PermissionKey, orgId?: string) => boolean;
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
        try {
          // Verify token is still valid
          const { valid, user: verifiedUser } = await apiClient.verifyToken();

          if (valid && verifiedUser) {
            // Decode JWT to extract permissions
            try {
              const jwtPayload = jwtDecode<JWTPayload>(token);

              // Merge JWT permissions into user organizations
              const userWithPermissions: ApiUser = {
                ...verifiedUser,
                organizations: verifiedUser.organizations.map(org => {
                  // Find matching organization in JWT payload
                  const jwtOrg = jwtPayload.organizations.find(
                    jwtO => jwtO.organizationId === org.id
                  );

                  return {
                    ...org,
                    permissions: jwtOrg?.permissions, // Add permissions from JWT
                  };
                }),
              };

              setUser(userWithPermissions);
            } catch (decodeError) {
              console.error('Failed to decode JWT:', decodeError);
              // Fallback to user data without permissions
              setUser(verifiedUser);
            }

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
            // Token invalid or expired, clear storage
            apiClient.removeToken();
            setUser(null);
            setError('Session expired. Please login again.');
          }
        } catch (err) {
          // Token verification failed
          console.error('Token verification error:', err);
          apiClient.removeToken();
          setUser(null);
          setError('Session expired. Please login again.');
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

      // Decode JWT to extract permissions
      const token = apiClient.getToken();
      if (token) {
        try {
          const jwtPayload = jwtDecode<JWTPayload>(token);

          // Merge JWT permissions into user organizations
          const userWithPermissions: ApiUser = {
            ...response.user,
            organizations: response.user.organizations.map(org => {
              // Find matching organization in JWT payload
              const jwtOrg = jwtPayload.organizations.find(
                jwtO => jwtO.organizationId === org.id
              );

              return {
                ...org,
                permissions: jwtOrg?.permissions, // Add permissions from JWT
              };
            }),
          };

          setUser(userWithPermissions);
        } catch (decodeError) {
          console.error('Failed to decode JWT:', decodeError);
          // Fallback to user data without permissions
          setUser(response.user);
        }
      } else {
        setUser(response.user);
      }

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

  /**
   * Get screen access permissions for current user.
   * Admin users get full access, others get data views only.
   * In the future, this will be loaded from the user's role template.
   */
  const getScreenAccess = useCallback((): ScreenPermissions => {
    // Admin users have full access to all screens
    if (user?.role === 'admin') {
      return {
        screen_TimelineLab: true,
        screen_MatrixLab: true,
        screen_GridLab: true,
        screen_Pfa10Lab: true,
        screen_Export: true,
        screen_ApiConnectivity: true,
        screen_ApiServers: true,
        screen_DataImport: true,
        screen_MappingStudio: true,
        screen_FieldConfig: true,
        screen_BeoGlass: true,
        screen_Organizations: true,
        screen_SystemSettings: true,
        screen_Notifications: true,
        screen_UserManagement: true,
        screen_RoleTemplates: true,
        screen_MasterData: true,
        screen_AuditSearch: true,
        screen_RoleDrift: true,
        screen_AiUsageLogs: true,
        screen_SyncLogs: true,
        screen_SyncHealth: true,
        screen_NarrativeReader: true,
        screen_ArbitrageOpportunities: true,
        screen_VendorPricing: true,
        screen_ScenarioBuilder: true,
      };
    }

    // Non-admin users get data views only by default
    // TODO: Load from user's role template when available
    return {
      screen_TimelineLab: true,
      screen_MatrixLab: true,
      screen_GridLab: true,
      screen_Pfa10Lab: true,
      screen_Export: true,
    };
  }, [user?.role]);

  const screenAccess = getScreenAccess();

  const canAccessScreen = useCallback((screen: ScreenKey): boolean => {
    // Admin always has full access
    if (user?.role === 'admin') return true;
    return !!screenAccess[screen];
  }, [user?.role, screenAccess]);

  const hasPermission = useCallback((permission: PermissionKey, orgId?: string): boolean => {
    // Admin always has full permissions
    if (user?.role === 'admin') return true;

    const targetOrgId = orgId || currentOrganizationId;
    if (!targetOrgId || !user?.organizations) return false;

    const org = user.organizations.find(o => o.id === targetOrgId);
    if (!org?.permissions) return false;

    return !!(org.permissions as unknown as Record<string, boolean>)[permission];
  }, [user?.role, user?.organizations, currentOrganizationId]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    currentOrganizationId,
    setCurrentOrganizationId: updateCurrentOrganizationId,
    error,
    screenAccess,
    canAccessScreen,
    hasPermission,
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
