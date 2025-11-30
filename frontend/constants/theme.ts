/**
 * PFA Vanguard Theme Configuration
 * Centralized design tokens for consistent theming across all components.
 *
 * Usage:
 * - Import tokens: import { theme, cn } from '../constants/theme';
 * - Use classes: className={theme.button.primary}
 * - Combine classes: className={cn(theme.card.base, 'custom-class')}
 */

// Utility function to combine class names (like clsx/classnames)
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// THEME TOKENS - Standardized design system
// ============================================================================

export const theme = {
  // ---------------------------------------------------------------------------
  // COLORS - Semantic color tokens with dark mode support
  // ---------------------------------------------------------------------------
  colors: {
    // Background colors
    bg: {
      primary: 'bg-white dark:bg-slate-900',
      secondary: 'bg-slate-50 dark:bg-slate-800',
      tertiary: 'bg-slate-100 dark:bg-slate-700',
      elevated: 'bg-white dark:bg-slate-800',
      overlay: 'bg-black/50',
      // Accent backgrounds
      accent: 'bg-blue-50 dark:bg-blue-900/20',
      success: 'bg-green-50 dark:bg-green-900/20',
      warning: 'bg-yellow-50 dark:bg-yellow-900/20',
      error: 'bg-red-50 dark:bg-red-900/20',
      info: 'bg-cyan-50 dark:bg-cyan-900/20',
    },
    // Text colors
    text: {
      primary: 'text-slate-900 dark:text-white',
      secondary: 'text-slate-600 dark:text-slate-300',
      tertiary: 'text-slate-500 dark:text-slate-400',
      muted: 'text-slate-400 dark:text-slate-500',
      inverse: 'text-white dark:text-slate-900',
      // Semantic text
      accent: 'text-blue-600 dark:text-blue-400',
      success: 'text-green-600 dark:text-green-400',
      warning: 'text-yellow-600 dark:text-yellow-400',
      error: 'text-red-600 dark:text-red-400',
      info: 'text-cyan-600 dark:text-cyan-400',
    },
    // Border colors
    border: {
      default: 'border-slate-200 dark:border-slate-700',
      strong: 'border-slate-300 dark:border-slate-600',
      muted: 'border-slate-100 dark:border-slate-800',
      accent: 'border-blue-500 dark:border-blue-400',
      success: 'border-green-500 dark:border-green-400',
      warning: 'border-yellow-500 dark:border-yellow-400',
      error: 'border-red-500 dark:border-red-400',
    },
  },

  // ---------------------------------------------------------------------------
  // STATUS BADGES - Consistent status indicators
  // ---------------------------------------------------------------------------
  status: {
    active: {
      bg: 'bg-green-500/20',
      text: 'text-green-400',
      border: 'border-green-500/40',
      dot: 'bg-green-400',
    },
    inactive: {
      bg: 'bg-slate-500/20',
      text: 'text-slate-400',
      border: 'border-slate-500/40',
      dot: 'bg-slate-400',
    },
    suspended: {
      bg: 'bg-yellow-500/20',
      text: 'text-yellow-400',
      border: 'border-yellow-500/40',
      dot: 'bg-yellow-400',
    },
    locked: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      border: 'border-red-500/40',
      dot: 'bg-red-400',
    },
    archived: {
      bg: 'bg-gray-500/20',
      text: 'text-gray-400',
      border: 'border-gray-500/40',
      dot: 'bg-gray-400',
    },
    pending: {
      bg: 'bg-cyan-500/20',
      text: 'text-cyan-400',
      border: 'border-cyan-500/40',
      dot: 'bg-cyan-400',
    },
    syncing: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      border: 'border-blue-500/40',
      dot: 'bg-blue-400',
    },
    error: {
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      border: 'border-red-500/40',
      dot: 'bg-red-400',
    },
  },

  // ---------------------------------------------------------------------------
  // BUTTONS - Standardized button variants
  // ---------------------------------------------------------------------------
  button: {
    // Base styles (apply to all buttons)
    base: 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
    // Size variants
    sizes: {
      xs: 'px-2 py-1 text-xs rounded',
      sm: 'px-3 py-1.5 text-sm rounded-md',
      md: 'px-4 py-2 text-sm rounded-lg',
      lg: 'px-5 py-2.5 text-base rounded-lg',
      xl: 'px-6 py-3 text-lg rounded-xl',
    },
    // Color variants
    primary: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600',
    secondary: 'bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white focus:ring-slate-500 dark:bg-slate-700 dark:hover:bg-slate-600',
    outline: 'border border-slate-300 dark:border-slate-600 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-slate-500',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 focus:ring-slate-500',
    danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white focus:ring-red-500',
    success: 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white focus:ring-green-500',
    warning: 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-white focus:ring-yellow-500',
    // Icon button (square)
    icon: {
      sm: 'p-1.5 rounded-md',
      md: 'p-2 rounded-lg',
      lg: 'p-3 rounded-xl',
    },
  },

  // ---------------------------------------------------------------------------
  // INPUTS - Form input styles
  // ---------------------------------------------------------------------------
  input: {
    base: 'w-full transition-all duration-200 focus:outline-none',
    // Size variants
    sizes: {
      sm: 'px-2 py-1 text-sm rounded',
      md: 'px-3 py-2 text-sm rounded-lg',
      lg: 'px-4 py-3 text-base rounded-lg',
    },
    // States
    default: 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20',
    error: 'bg-white dark:bg-slate-800 border border-red-500 text-slate-900 dark:text-white placeholder-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20',
    disabled: 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-500 cursor-not-allowed',
    // Label
    label: 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5',
    labelRequired: 'text-red-500 ml-0.5',
    // Helper/Error text
    helper: 'mt-1.5 text-xs text-slate-500 dark:text-slate-400',
    errorText: 'mt-1.5 text-xs text-red-500 dark:text-red-400',
  },

  // ---------------------------------------------------------------------------
  // SELECT - Dropdown select styles
  // ---------------------------------------------------------------------------
  select: {
    base: 'w-full transition-all duration-200 focus:outline-none appearance-none cursor-pointer',
    default: 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 px-3 py-2 pr-10 text-sm rounded-lg',
  },

  // ---------------------------------------------------------------------------
  // CHECKBOX & RADIO - Toggle inputs
  // ---------------------------------------------------------------------------
  checkbox: {
    base: 'rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-2 focus:ring-offset-0 dark:focus:ring-offset-slate-800 transition-colors',
    sizes: {
      sm: 'w-3.5 h-3.5',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    },
    label: 'text-sm text-slate-700 dark:text-slate-300 select-none',
  },

  // ---------------------------------------------------------------------------
  // CARDS - Container components
  // ---------------------------------------------------------------------------
  card: {
    base: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg',
    elevated: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg',
    interactive: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all cursor-pointer',
    // Padding variants
    padding: {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    },
    header: 'px-6 py-4 border-b border-slate-200 dark:border-slate-700',
    body: 'p-6',
    footer: 'px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50',
  },

  // ---------------------------------------------------------------------------
  // MODALS - Dialog/Modal styles
  // ---------------------------------------------------------------------------
  modal: {
    overlay: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4',
    container: 'bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-hidden flex flex-col',
    // Size variants
    sizes: {
      sm: 'max-w-md w-full',
      md: 'max-w-lg w-full',
      lg: 'max-w-2xl w-full',
      xl: 'max-w-4xl w-full',
      full: 'max-w-[95vw] w-full',
    },
    header: 'flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900',
    title: 'text-lg font-bold text-slate-900 dark:text-white',
    body: 'flex-1 overflow-y-auto p-6',
    footer: 'flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900',
  },

  // ---------------------------------------------------------------------------
  // BADGES - Label/Tag components
  // ---------------------------------------------------------------------------
  badge: {
    base: 'inline-flex items-center font-medium rounded-full border',
    sizes: {
      xs: 'px-1.5 py-0.5 text-[10px]',
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-xs',
      lg: 'px-3 py-1 text-sm',
    },
    // Color variants
    default: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600',
    primary: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
    warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    info: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
  },

  // ---------------------------------------------------------------------------
  // TABLES - Data table styles
  // ---------------------------------------------------------------------------
  table: {
    container: 'w-full overflow-x-auto',
    base: 'w-full border-collapse',
    header: 'bg-slate-50 dark:bg-slate-900',
    headerCell: 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700',
    body: 'divide-y divide-slate-200 dark:divide-slate-700',
    row: 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors',
    cell: 'px-4 py-3 text-sm text-slate-700 dark:text-slate-300',
  },

  // ---------------------------------------------------------------------------
  // TOOLTIPS - Hover information
  // ---------------------------------------------------------------------------
  tooltip: {
    base: 'absolute z-50 px-3 py-2 text-sm rounded-lg shadow-lg',
    dark: 'bg-slate-900 dark:bg-slate-700 text-white',
    light: 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600',
  },

  // ---------------------------------------------------------------------------
  // ALERTS/TOASTS - Notification styles
  // ---------------------------------------------------------------------------
  alert: {
    base: 'flex items-start gap-3 p-4 rounded-lg border',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300',
  },

  // ---------------------------------------------------------------------------
  // TABS - Tab navigation
  // ---------------------------------------------------------------------------
  tabs: {
    container: 'border-b border-slate-200 dark:border-slate-700',
    list: 'flex gap-1',
    tab: {
      base: 'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
      active: 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white border-b-2 border-blue-500',
      inactive: 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800',
    },
  },

  // ---------------------------------------------------------------------------
  // DIVIDERS - Separators
  // ---------------------------------------------------------------------------
  divider: {
    horizontal: 'w-full h-px bg-slate-200 dark:bg-slate-700',
    vertical: 'h-full w-px bg-slate-200 dark:bg-slate-700',
  },

  // ---------------------------------------------------------------------------
  // AVATARS - User/Org icons
  // ---------------------------------------------------------------------------
  avatar: {
    base: 'rounded-full flex items-center justify-center font-semibold overflow-hidden',
    sizes: {
      xs: 'w-6 h-6 text-xs',
      sm: 'w-8 h-8 text-sm',
      md: 'w-10 h-10 text-base',
      lg: 'w-12 h-12 text-lg',
      xl: 'w-16 h-16 text-xl',
    },
    colors: {
      default: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
      primary: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      accent: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    },
  },

  // ---------------------------------------------------------------------------
  // SPACING - Consistent spacing scale
  // ---------------------------------------------------------------------------
  spacing: {
    section: 'space-y-6',
    group: 'space-y-4',
    stack: 'space-y-2',
    inline: 'space-x-2',
    gap: {
      xs: 'gap-1',
      sm: 'gap-2',
      md: 'gap-4',
      lg: 'gap-6',
      xl: 'gap-8',
    },
  },

  // ---------------------------------------------------------------------------
  // TYPOGRAPHY - Text styles
  // ---------------------------------------------------------------------------
  text: {
    // Headings
    h1: 'text-3xl font-bold text-slate-900 dark:text-white',
    h2: 'text-2xl font-bold text-slate-900 dark:text-white',
    h3: 'text-xl font-bold text-slate-900 dark:text-white',
    h4: 'text-lg font-semibold text-slate-900 dark:text-white',
    h5: 'text-base font-semibold text-slate-900 dark:text-white',
    h6: 'text-sm font-semibold text-slate-900 dark:text-white',
    // Body text
    body: 'text-sm text-slate-700 dark:text-slate-300',
    small: 'text-xs text-slate-600 dark:text-slate-400',
    tiny: 'text-[11px] text-slate-500 dark:text-slate-500',
    micro: 'text-[10px] text-slate-500 dark:text-slate-500',
    // Special
    label: 'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400',
    code: 'font-mono text-sm bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-200',
  },

  // ---------------------------------------------------------------------------
  // SIDEBAR - Navigation sidebar
  // ---------------------------------------------------------------------------
  sidebar: {
    container: 'bg-slate-900 dark:bg-slate-950 border-r border-slate-800',
    item: {
      base: 'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
      active: 'bg-blue-600 text-white',
      inactive: 'text-slate-400 hover:bg-slate-800 hover:text-white',
    },
    section: 'px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500',
  },

  // ---------------------------------------------------------------------------
  // LOADING - Loading states
  // ---------------------------------------------------------------------------
  loading: {
    spinner: 'animate-spin rounded-full border-2 border-current border-t-transparent',
    skeleton: 'animate-pulse bg-slate-200 dark:bg-slate-700 rounded',
    overlay: 'absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center',
  },
} as const;

// ============================================================================
// THEME PRESETS - Pre-defined theme combinations
// ============================================================================

export const themePresets = {
  // Light theme overrides (default)
  light: {
    name: 'Light',
    class: '',
  },
  // Dark theme (uses dark: prefix)
  dark: {
    name: 'Dark',
    class: 'dark',
  },
  // Future theme placeholders
  // Add more themes here with custom class prefixes
} as const;

// ============================================================================
// COMPONENT STYLE HELPERS - Quick access to common patterns
// ============================================================================

export const styles = {
  // Page container
  page: 'min-h-screen bg-slate-50 dark:bg-slate-900',

  // Flex layouts
  flexCenter: 'flex items-center justify-center',
  flexBetween: 'flex items-center justify-between',
  flexStart: 'flex items-center justify-start',
  flexEnd: 'flex items-center justify-end',
  flexCol: 'flex flex-col',

  // Transitions
  transition: 'transition-all duration-200',
  transitionFast: 'transition-all duration-100',
  transitionSlow: 'transition-all duration-300',

  // Focus states
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900',

  // Truncate text
  truncate: 'truncate overflow-hidden text-ellipsis whitespace-nowrap',

  // Scrollbar styling
  scrollbar: 'scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent',
} as const;

// Type exports for TypeScript support
export type ThemeStatus = keyof typeof theme.status;
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning';
export type ButtonSize = keyof typeof theme.button.sizes;
export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = keyof typeof theme.badge.sizes;
export type ModalSize = keyof typeof theme.modal.sizes;
export type AvatarSize = keyof typeof theme.avatar.sizes;
