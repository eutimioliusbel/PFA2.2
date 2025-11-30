/**
 * useTheme Hook
 * Multi-theme support with persistence and system preference detection.
 *
 * Available themes: 'light' | 'dark' | 'high-contrast' | 'sepia' | 'system'
 *
 * Usage (Legacy - for App.tsx):
 * useTheme({ currentUser, systemConfig });
 *
 * Usage (New - standalone):
 * const { theme, setTheme, resolvedTheme, toggleTheme } = useThemeControl();
 */

import { useState, useEffect, useCallback } from 'react';
import type { User, SystemConfig } from '../types';

// Theme types
export type ThemeName = 'light' | 'dark' | 'high-contrast' | 'sepia';
export type ThemePreference = ThemeName | 'system';

const THEME_STORAGE_KEY = 'pfa-theme';
const ALL_THEME_CLASSES: ThemeName[] = ['light', 'dark', 'high-contrast', 'sepia'];

// Theme metadata for UI
export const themeOptions: Record<ThemeName, { label: string; description: string; icon: string }> = {
  light: {
    label: 'Light',
    description: 'Default light theme',
    icon: 'Sun',
  },
  dark: {
    label: 'Dark',
    description: 'Dark theme for low-light environments',
    icon: 'Moon',
  },
  'high-contrast': {
    label: 'High Contrast',
    description: 'Maximum contrast for accessibility',
    icon: 'Contrast',
  },
  sepia: {
    label: 'Sepia',
    description: 'Warm tones to reduce eye strain',
    icon: 'Coffee',
  },
};

// Detect system theme preference
function getSystemTheme(): ThemeName {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Get stored theme from localStorage
function getStoredTheme(): ThemePreference | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored && [...ALL_THEME_CLASSES, 'system'].includes(stored)) {
    return stored as ThemePreference;
  }
  return null;
}

// Resolve 'system' to actual theme
function resolveTheme(preference: ThemePreference): ThemeName {
  return preference === 'system' ? getSystemTheme() : preference;
}

// Apply theme class to document
function applyThemeClass(theme: ThemeName): void {
  const html = document.documentElement;

  // Add transitioning class to prevent flash
  html.classList.add('theme-transitioning');

  // Remove all theme classes
  ALL_THEME_CLASSES.forEach((t) => html.classList.remove(t));

  // Add the new theme class
  html.classList.add(theme);

  // Remove transitioning class after animation frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      html.classList.remove('theme-transitioning');
    });
  });
}

// ============================================
// Legacy Hook (backward compatible with App.tsx)
// ============================================

interface UseThemeProps {
  currentUser: User | null;
  systemConfig: SystemConfig;
}

export function useTheme({ currentUser, systemConfig }: UseThemeProps): void {
  useEffect(() => {
    // Determine theme from user preference or system config
    const userPref = currentUser?.themePreference as ThemePreference | undefined;
    const preference = userPref === 'system' || !userPref
      ? systemConfig.defaultTheme as ThemePreference
      : userPref;

    // Resolve and apply
    const resolved = resolveTheme(preference || 'dark');
    applyThemeClass(resolved);

    // Store preference
    if (userPref) {
      localStorage.setItem(THEME_STORAGE_KEY, userPref);
    }
  }, [currentUser, systemConfig.defaultTheme]);
}

// ============================================
// New Hook (standalone theme control)
// ============================================

interface UseThemeControlReturn {
  /** Current theme preference (may be 'system') */
  theme: ThemePreference;
  /** Resolved theme (never 'system', always actual theme) */
  resolvedTheme: ThemeName;
  /** Set theme preference */
  setTheme: (theme: ThemePreference) => void;
  /** Toggle between light and dark */
  toggleTheme: () => void;
  /** List of available themes */
  themes: typeof themeOptions;
  /** Check if current theme is dark-based */
  isDark: boolean;
}

export function useThemeControl(): UseThemeControlReturn {
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme() || 'system');
  const [resolvedTheme, setResolvedTheme] = useState<ThemeName>(() =>
    resolveTheme(getStoredTheme() || 'system')
  );

  // Set theme and persist
  const setTheme = useCallback((newTheme: ThemePreference) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);

    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  // Apply theme on mount and handle system preference changes
  useEffect(() => {
    applyThemeClass(resolvedTheme);

    // Listen for system theme changes when using 'system' mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemChange = () => {
      if (theme === 'system') {
        const newResolved = getSystemTheme();
        setResolvedTheme(newResolved);
        applyThemeClass(newResolved);
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme, resolvedTheme]);

  // Sync across browser tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        const newTheme = e.newValue as ThemePreference;
        setThemeState(newTheme);
        const resolved = resolveTheme(newTheme);
        setResolvedTheme(resolved);
        applyThemeClass(resolved);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const isDark = resolvedTheme === 'dark' || resolvedTheme === 'high-contrast';

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    themes: themeOptions,
    isDark,
  };
}

export default useTheme;
