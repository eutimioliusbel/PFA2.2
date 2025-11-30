/**
 * Button Component
 * Standardized button with consistent theming across the application.
 *
 * Usage:
 * <Button variant="primary" size="md" onClick={handleClick}>Save</Button>
 * <Button variant="outline" size="sm" leftIcon={<Plus />}>Add Item</Button>
 * <Button variant="ghost" size="md" loading>Processing...</Button>
 */

import React from 'react';
import { theme, cn, ButtonVariant, ButtonSize } from '../../constants/theme';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className,
  children,
  ...props
}) => {
  const variantClasses: Record<ButtonVariant, string> = {
    primary: theme.button.primary,
    secondary: theme.button.secondary,
    outline: theme.button.outline,
    ghost: theme.button.ghost,
    danger: theme.button.danger,
    success: theme.button.success,
    warning: theme.button.warning,
  };

  return (
    <button
      className={cn(
        theme.button.base,
        theme.button.sizes[size],
        variantClasses[variant],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : leftIcon ? (
        <span className="mr-2">{leftIcon}</span>
      ) : null}
      {children}
      {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};

/**
 * IconButton Component
 * Square button for icon-only actions
 */
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon: React.ReactNode;
  label: string; // Required for accessibility
}

export const IconButton: React.FC<IconButtonProps> = ({
  variant = 'ghost',
  size = 'md',
  loading = false,
  icon,
  label,
  disabled,
  className,
  ...props
}) => {
  const variantClasses: Record<ButtonVariant, string> = {
    primary: theme.button.primary,
    secondary: theme.button.secondary,
    outline: theme.button.outline,
    ghost: theme.button.ghost,
    danger: theme.button.danger,
    success: theme.button.success,
    warning: theme.button.warning,
  };

  return (
    <button
      className={cn(
        theme.button.base,
        theme.button.icon[size],
        variantClasses[variant],
        className
      )}
      disabled={disabled || loading}
      title={label}
      aria-label={label}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
    </button>
  );
};

export default Button;
