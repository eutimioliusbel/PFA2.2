// backend/src/services/aiDataHooks/index.ts
/**
 * AI Data Hooks Module
 *
 * Phase 6, Task 6.5 of ADR-005 Multi-Tenant Access Control
 *
 * Exports all AI data collection services for easy import.
 */

export { DataCollectionService, default as dataCollectionService } from './DataCollectionService';
export type {
  PermissionChangeData,
  ExternalEntitySyncData,
  UserActivityData,
  BulkOperationData,
  AuditContext,
  AITrainingDataOptions,
  AITrainingData,
} from './DataCollectionService';
