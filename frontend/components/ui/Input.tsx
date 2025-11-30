/**
 * Input Component
 * Standardized form input with consistent theming.
 *
 * Usage:
 * <Input label="Email" type="email" placeholder="Enter email" />
 * <Input label="Password" type="password" error="Password is required" />
 * <TextArea label="Description" rows={4} />
 */

import React, { forwardRef } from 'react';
import { theme, cn } from '../../constants/theme';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helper,
      required,
      inputSize = 'md',
      leftIcon,
      rightIcon,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputClasses = cn(
      theme.input.base,
      theme.input.sizes[inputSize],
      disabled ? theme.input.disabled : error ? theme.input.error : theme.input.default,
      leftIcon ? 'pl-10' : undefined,
      rightIcon ? 'pr-10' : undefined,
      className
    );

    return (
      <div className="w-full">
        {label && (
          <label className={theme.input.label}>
            {label}
            {required && <span className={theme.input.labelRequired}>*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={inputClasses}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${props.id}-error` : helper ? `${props.id}-helper` : undefined}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={`${props.id}-error`} className={theme.input.errorText}>
            {error}
          </p>
        )}
        {helper && !error && (
          <p id={`${props.id}-helper`} className={theme.input.helper}>
            {helper}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/**
 * TextArea Component
 */
interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, helper, required, inputSize = 'md', className, disabled, ...props }, ref) => {
    const inputClasses = cn(
      theme.input.base,
      theme.input.sizes[inputSize],
      disabled ? theme.input.disabled : error ? theme.input.error : theme.input.default,
      'resize-none',
      className
    );

    return (
      <div className="w-full">
        {label && (
          <label className={theme.input.label}>
            {label}
            {required && <span className={theme.input.labelRequired}>*</span>}
          </label>
        )}
        <textarea ref={ref} className={inputClasses} disabled={disabled} {...props} />
        {error && <p className={theme.input.errorText}>{error}</p>}
        {helper && !error && <p className={theme.input.helper}>{helper}</p>}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

/**
 * Select Component
 */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helper, required, options, placeholder, className, disabled, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className={theme.input.label}>
            {label}
            {required && <span className={theme.input.labelRequired}>*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(theme.select.default, disabled && 'opacity-50 cursor-not-allowed', className)}
            disabled={disabled}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && <p className={theme.input.errorText}>{error}</p>}
        {helper && !error && <p className={theme.input.helper}>{helper}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

/**
 * Checkbox Component
 */
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  description?: string;
  checkboxSize?: 'sm' | 'md' | 'lg';
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, checkboxSize = 'md', className, ...props }, ref) => {
    return (
      <label className={cn('flex items-start gap-3 cursor-pointer group', className)}>
        <input
          ref={ref}
          type="checkbox"
          className={cn(
            theme.checkbox.base,
            theme.checkbox.sizes[checkboxSize],
            'cursor-pointer'
          )}
          {...props}
        />
        {(label || description) && (
          <div className="flex flex-col">
            {label && <span className={theme.checkbox.label}>{label}</span>}
            {description && (
              <span className="text-xs text-slate-500 dark:text-slate-400">{description}</span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Input;
