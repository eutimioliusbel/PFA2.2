/**
 * Theme Selector Component
 *
 * Allows users to select their personal theme preference.
 * Admin users can also set the system-wide default theme.
 *
 * Theme Hierarchy:
 * 1. User preference (if not 'system')
 * 2. System default (admin-configured)
 * 3. OS preference (if user has 'system' selected)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Contrast,
  Coffee,
  CheckCircle,
  Loader2,
  Palette,
  Shield,
  Info,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/apiClient';
import { useThemeControl, type ThemeName, type ThemePreference, themeOptions } from '../../hooks/useTheme';

// Icon mapping for themes
const themeIcons: Record<ThemeName, React.ReactNode> = {
  light: <Sun className="w-5 h-5" />,
  dark: <Moon className="w-5 h-5" />,
  'high-contrast': <Contrast className="w-5 h-5" />,
  sepia: <Coffee className="w-5 h-5" />,
};

// Color preview for each theme
const themePreviewColors: Record<ThemeName, { bg: string; border: string; text: string }> = {
  light: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-900' },
  dark: { bg: 'bg-slate-900', border: 'border-slate-700', text: 'text-white' },
  'high-contrast': { bg: 'bg-black', border: 'border-yellow-400', text: 'text-white' },
  sepia: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900' },
};

interface ThemeSelectorProps {
  showAdminSettings?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ showAdminSettings = false }) => {
  const { user } = useAuth();
  const { theme, setTheme, resolvedTheme } = useThemeControl();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Admin settings
  const [systemDefaultTheme, setSystemDefaultTheme] = useState<ThemeName>('dark');
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  const isAdmin = user?.role === 'admin';
  const showAdmin = showAdminSettings && isAdmin;

  // Load system default theme for admins
  useEffect(() => {
    if (showAdmin) {
      const fetchSystemDefault = async () => {
        setLoadingAdmin(true);
        try {
          const response = await apiClient.get<{ success: boolean; config: { defaultTheme: ThemeName } }>(
            '/api/system-config'
          );
          if (response.config?.defaultTheme) {
            setSystemDefaultTheme(response.config.defaultTheme);
          }
        } catch (err) {
          console.error('Failed to load system config:', err);
        } finally {
          setLoadingAdmin(false);
        }
      };
      fetchSystemDefault();
    }
  }, [showAdmin]);

  // Handle user theme change
  const handleThemeChange = useCallback(async (newTheme: ThemePreference) => {
    setTheme(newTheme);
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.put('/api/users/me/preferences', {
        themePreference: newTheme,
      });
      setSuccess('Theme preference saved');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save preference';
      setError(message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  }, [setTheme]);

  // Handle admin system default change
  const handleSystemDefaultChange = useCallback(async (newDefault: ThemeName) => {
    setSystemDefaultTheme(newDefault);
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.put('/api/system-config', {
        defaultTheme: newDefault,
      });
      setSuccess('System default theme updated');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update system default';
      setError(message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Palette className="w-6 h-6 text-blue-400" />
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Appearance
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Customize how PFA Vanguard looks for you
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-2">
          <Info className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* User Theme Selection */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-slate-400" />
          <h3 className="font-medium text-slate-900 dark:text-white">Your Theme Preference</h3>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Choose a theme for your account. Select "System Default" to use the organization's default theme,
          or "System" to match your operating system preference.
        </p>

        {/* Theme Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          {/* System Default Option */}
          <button
            onClick={() => handleThemeChange('system')}
            className={`relative p-4 rounded-lg border-2 transition-all ${
              theme === 'system'
                ? 'border-blue-500 ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <Monitor className="w-8 h-8 text-slate-600 dark:text-slate-300" />
              <span className="text-sm font-medium text-slate-900 dark:text-white">System</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Match OS</span>
            </div>
            {theme === 'system' && (
              <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-blue-500" />
            )}
          </button>

          {/* Theme Options */}
          {(Object.entries(themeOptions) as [ThemeName, typeof themeOptions[ThemeName]][]).map(([key, value]) => {
            const preview = themePreviewColors[key];
            const isSelected = theme === key;

            return (
              <button
                key={key}
                onClick={() => handleThemeChange(key)}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  {/* Theme Preview */}
                  <div className={`w-12 h-8 rounded ${preview.bg} ${preview.border} border flex items-center justify-center`}>
                    <div className={preview.text}>{themeIcons[key]}</div>
                  </div>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{value.label}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 text-center">{value.description}</span>
                </div>
                {isSelected && (
                  <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-blue-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Current Theme Info */}
        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-medium">Currently active: </span>
            {themeOptions[resolvedTheme].label}
            {theme === 'system' && (
              <span className="text-slate-500 dark:text-slate-400"> (from system preference)</span>
            )}
          </p>
        </div>
      </div>

      {/* Admin: System Default Theme */}
      {showAdmin && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-orange-400" />
            <h3 className="font-medium text-slate-900 dark:text-white">System Default Theme</h3>
            <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded">
              Admin
            </span>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Set the default theme for all users who haven't chosen a personal preference.
            This applies organization-wide and affects new users automatically.
          </p>

          {loadingAdmin ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.entries(themeOptions) as [ThemeName, typeof themeOptions[ThemeName]][]).map(([key, value]) => {
                const preview = themePreviewColors[key];
                const isSelected = systemDefaultTheme === key;

                return (
                  <button
                    key={key}
                    onClick={() => handleSystemDefaultChange(key)}
                    className={`relative p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-orange-500 ring-2 ring-orange-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-600'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-10 h-6 rounded ${preview.bg} ${preview.border} border flex items-center justify-center`}>
                        <div className={`${preview.text} scale-75`}>{themeIcons[key]}</div>
                      </div>
                      <span className="text-xs font-medium text-slate-900 dark:text-white">{value.label}</span>
                    </div>
                    {isSelected && (
                      <CheckCircle className="absolute top-1 right-1 w-4 h-4 text-orange-500" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <p className="text-sm text-orange-700 dark:text-orange-400">
              <Info className="w-4 h-4 inline mr-1" />
              Users with "System" preference will follow their OS setting, not this default.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;
