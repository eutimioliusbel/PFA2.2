// components/permissions/index.ts
/**
 * Permission Components Module
 *
 * Exports all permission-related UI components for the PFA Vanguard application.
 * These components implement the multi-tenant access control system defined in ADR-005.
 */

// Core permission UI components
export { PermissionTooltip } from './PermissionTooltip';
export { PermissionLoadingSkeleton } from './PermissionLoadingSkeleton';
export { PermissionErrorToast } from './PermissionErrorToast';

// Re-export parent-level permission components
export { PermissionButton } from '../PermissionButton';
export { PermissionGuard } from '../PermissionGuard';
