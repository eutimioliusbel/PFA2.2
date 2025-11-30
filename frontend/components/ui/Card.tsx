/**
 * Card Component
 * Standardized card/container with consistent theming.
 *
 * Usage:
 * <Card>Simple content</Card>
 * <Card variant="elevated" padding="lg">
 *   <Card.Header title="Settings" subtitle="Configure options" />
 *   <Card.Body>Content</Card.Body>
 *   <Card.Footer>Footer actions</Card.Footer>
 * </Card>
 */

import React from 'react';
import { theme, cn } from '../../constants/theme';

type CardVariant = 'base' | 'elevated' | 'interactive';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> & {
  Header: typeof CardHeader;
  Body: typeof CardBody;
  Footer: typeof CardFooter;
  Section: typeof CardSection;
} = ({ variant = 'base', padding = 'none', className, children, onClick }) => {
  const variantClasses: Record<CardVariant, string> = {
    base: theme.card.base,
    elevated: theme.card.elevated,
    interactive: theme.card.interactive,
  };

  return (
    <div
      className={cn(variantClasses[variant], theme.card.padding[padding], className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
};

/**
 * Card Header
 */
interface CardHeaderProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  icon,
  action,
  className,
  children,
}) => (
  <div className={cn(theme.card.header, 'flex items-center justify-between', className)}>
    <div className="flex items-center gap-3">
      {icon && <div className="text-blue-500">{icon}</div>}
      <div>
        {title && <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>}
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        {children}
      </div>
    </div>
    {action && <div>{action}</div>}
  </div>
);

/**
 * Card Body
 */
interface CardBodyProps {
  className?: string;
  children: React.ReactNode;
  noPadding?: boolean;
}

const CardBody: React.FC<CardBodyProps> = ({ className, children, noPadding }) => (
  <div className={cn(noPadding ? '' : theme.card.body, className)}>{children}</div>
);

/**
 * Card Footer
 */
interface CardFooterProps {
  className?: string;
  children: React.ReactNode;
}

const CardFooter: React.FC<CardFooterProps> = ({ className, children }) => (
  <div className={cn(theme.card.footer, className)}>{children}</div>
);

/**
 * Card Section - For dividing card content
 */
interface CardSectionProps {
  title?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}

const CardSection: React.FC<CardSectionProps> = ({ title, description, className, children }) => (
  <div className={cn('py-4 border-b border-slate-200 dark:border-slate-700 last:border-0', className)}>
    {(title || description) && (
      <div className="mb-3">
        {title && (
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
        )}
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
    )}
    {children}
  </div>
);

// Attach sub-components
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
Card.Section = CardSection;

/**
 * StatCard - Pre-built card for displaying statistics
 */
interface StatCardProps {
  title: string;
  value: string | number;
  change?: { value: number; label?: string };
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  trend,
  className,
}) => {
  const trendConfig = {
    up: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
    down: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
    neutral: { color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
  };

  return (
    <Card variant="base" padding="md" className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
          {change && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={cn(
                  'text-xs font-medium px-1.5 py-0.5 rounded',
                  trend ? trendConfig[trend].bg : '',
                  trend ? trendConfig[trend].color : 'text-slate-600'
                )}
              >
                {change.value > 0 ? '+' : ''}
                {change.value}%
              </span>
              {change.label && (
                <span className="text-xs text-slate-500 dark:text-slate-400">{change.label}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};

/**
 * EmptyState - Pre-built card for empty states
 */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => (
  <div className={cn('text-center py-12 px-6', className)}>
    {icon && (
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
        {icon}
      </div>
    )}
    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
    {description && (
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{description}</p>
    )}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export default Card;
