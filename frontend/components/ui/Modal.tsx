/**
 * Modal Component
 * Standardized modal/dialog with consistent theming.
 *
 * Usage:
 * <Modal isOpen={showModal} onClose={handleClose} title="Edit User" size="lg">
 *   <Modal.Body>Content here</Modal.Body>
 *   <Modal.Footer>
 *     <Button variant="outline" onClick={handleClose}>Cancel</Button>
 *     <Button variant="primary" onClick={handleSave}>Save</Button>
 *   </Modal.Footer>
 * </Modal>
 */

import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { theme, cn, ModalSize } from '../../constants/theme';
import { IconButton } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: ModalSize;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> & {
  Header: typeof ModalHeader;
  Body: typeof ModalBody;
  Footer: typeof ModalFooter;
} = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  icon,
  children,
  className,
}) => {
  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    },
    [onClose, closeOnEscape]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div
      className={theme.modal.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && closeOnOverlayClick) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div className={cn(theme.modal.container, theme.modal.sizes[size], className)}>
        {/* Header */}
        {(title || showCloseButton) && (
          <div className={theme.modal.header}>
            <div className="flex items-center gap-3">
              {icon && <div className="text-blue-500">{icon}</div>}
              <div>
                {title && (
                  <h2 id="modal-title" className={theme.modal.title}>
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>
            {showCloseButton && (
              <IconButton
                icon={<X className="w-5 h-5" />}
                label="Close"
                variant="ghost"
                size="md"
                onClick={onClose}
              />
            )}
          </div>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  );
};

/**
 * Modal Header - Use when you need custom header content
 */
interface ModalHeaderProps {
  children: React.ReactNode;
  className?: string;
}

const ModalHeader: React.FC<ModalHeaderProps> = ({ children, className }) => (
  <div className={cn(theme.modal.header, className)}>{children}</div>
);

/**
 * Modal Body - Scrollable content area
 */
interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

const ModalBody: React.FC<ModalBodyProps> = ({ children, className, noPadding }) => (
  <div className={cn(theme.modal.body, noPadding && 'p-0', className)}>{children}</div>
);

/**
 * Modal Footer - Action buttons area
 */
interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

const ModalFooter: React.FC<ModalFooterProps> = ({ children, className }) => (
  <div className={cn(theme.modal.footer, className)}>{children}</div>
);

// Attach sub-components
Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

/**
 * ConfirmModal - Pre-built confirmation dialog
 */
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  icon,
}) => {
  const variantConfig = {
    danger: {
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      buttonVariant: 'danger' as const,
    },
    warning: {
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      buttonVariant: 'warning' as const,
    },
    info: {
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      buttonVariant: 'primary' as const,
    },
  };

  const config = variantConfig[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <Modal.Body>
        <div className="text-center">
          {icon && (
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4',
                config.iconBg
              )}
            >
              <div className={config.iconColor}>{icon}</div>
            </div>
          )}
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
        </div>
      </Modal.Body>
      <Modal.Footer className="justify-center">
        <button
          onClick={onClose}
          disabled={loading}
          className={cn(
            theme.button.base,
            theme.button.sizes.md,
            theme.button.outline,
            'min-w-[100px]'
          )}
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            theme.button.base,
            theme.button.sizes.md,
            theme.button[config.buttonVariant],
            'min-w-[100px]'
          )}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </span>
          ) : (
            confirmLabel
          )}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default Modal;
