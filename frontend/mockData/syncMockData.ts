/**
 * Mock data for ADR-008 Phase 2 Track B - UI Shell
 * Matches API contract from Track A backend implementation
 */

import type { PfaModification } from '../types';

export type SyncJobStatus = 'queued' | 'syncing' | 'success' | 'conflict' | 'failed';
export type ConflictResolutionStrategy = 'use_local' | 'use_remote' | 'merge';

export interface SyncConflict {
  id: string;
  fieldName: string;
  localValue: unknown;
  remoteValue: unknown;
  resolved: boolean;
  resolution?: ConflictResolutionStrategy;
  chosenValue?: unknown;
}

export interface SyncJob {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  status: SyncJobStatus;
  pfaIds: string[];
  totalRecords: number;
  syncedRecords: number;
  conflicts: SyncConflict[];
  errors: Array<{
    pfaId: string;
    message: string;
    timestamp: Date;
  }>;
  startedAt: Date;
  completedAt?: Date;
  retryCount: number;
  estimatedCompletionTime?: Date;
  progressPercent: number;
}

export interface SyncHistory {
  id: string;
  jobId: string;
  action: 'create' | 'update' | 'delete';
  pfaId: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  syncedAt: Date;
  syncedBy: string;
}

export interface RollbackVersion {
  id: string;
  pfaId: string;
  version: number;
  data: Record<string, unknown>;
  createdAt: Date;
  createdBy: string;
  reason?: string;
}

// Mock sync jobs
export const mockSyncJobs: SyncJob[] = [
  {
    id: 'sync-001',
    organizationId: 'org-rio',
    userId: 'user-123',
    userName: 'John Smith',
    status: 'success',
    pfaIds: ['PFA-001', 'PFA-002', 'PFA-003'],
    totalRecords: 3,
    syncedRecords: 3,
    conflicts: [],
    errors: [],
    startedAt: new Date('2025-11-28T10:00:00Z'),
    completedAt: new Date('2025-11-28T10:02:30Z'),
    retryCount: 0,
    progressPercent: 100,
  },
  {
    id: 'sync-002',
    organizationId: 'org-rio',
    userId: 'user-456',
    userName: 'Jane Doe',
    status: 'conflict',
    pfaIds: ['PFA-004', 'PFA-005'],
    totalRecords: 2,
    syncedRecords: 1,
    conflicts: [
      {
        id: 'conflict-001',
        fieldName: 'forecastStart',
        localValue: new Date('2025-12-01'),
        remoteValue: new Date('2025-12-15'),
        resolved: false,
      },
      {
        id: 'conflict-002',
        fieldName: 'monthlyRate',
        localValue: 5000,
        remoteValue: 5500,
        resolved: false,
      },
    ],
    errors: [],
    startedAt: new Date('2025-11-28T11:30:00Z'),
    retryCount: 0,
    progressPercent: 50,
  },
  {
    id: 'sync-003',
    organizationId: 'org-portarthur',
    userId: 'user-789',
    userName: 'Bob Johnson',
    status: 'syncing',
    pfaIds: ['PFA-010', 'PFA-011', 'PFA-012', 'PFA-013', 'PFA-014'],
    totalRecords: 5,
    syncedRecords: 2,
    conflicts: [],
    errors: [],
    startedAt: new Date('2025-11-28T14:00:00Z'),
    retryCount: 0,
    estimatedCompletionTime: new Date('2025-11-28T14:05:00Z'),
    progressPercent: 40,
  },
  {
    id: 'sync-004',
    organizationId: 'org-rio',
    userId: 'user-123',
    userName: 'John Smith',
    status: 'failed',
    pfaIds: ['PFA-020'],
    totalRecords: 1,
    syncedRecords: 0,
    conflicts: [],
    errors: [
      {
        pfaId: 'PFA-020',
        message: 'PEMS API returned 503 Service Unavailable',
        timestamp: new Date('2025-11-28T09:15:00Z'),
      },
    ],
    startedAt: new Date('2025-11-28T09:15:00Z'),
    completedAt: new Date('2025-11-28T09:15:30Z'),
    retryCount: 3,
    progressPercent: 0,
  },
];

// Mock sync history
export const mockSyncHistory: SyncHistory[] = [
  {
    id: 'hist-001',
    jobId: 'sync-001',
    action: 'update',
    pfaId: 'PFA-001',
    changes: {
      forecastStart: { before: new Date('2025-11-01'), after: new Date('2025-11-15') },
      forecastEnd: { before: new Date('2025-12-01'), after: new Date('2025-12-20') },
    },
    syncedAt: new Date('2025-11-28T10:01:00Z'),
    syncedBy: 'user-123',
  },
  {
    id: 'hist-002',
    jobId: 'sync-001',
    action: 'update',
    pfaId: 'PFA-002',
    changes: {
      monthlyRate: { before: 3000, after: 3500 },
    },
    syncedAt: new Date('2025-11-28T10:02:00Z'),
    syncedBy: 'user-123',
  },
];

// Mock rollback versions
export const mockRollbackVersions: RollbackVersion[] = [
  {
    id: 'ver-001',
    pfaId: 'PFA-001',
    version: 1,
    data: {
      forecastStart: new Date('2025-11-01'),
      forecastEnd: new Date('2025-12-01'),
      monthlyRate: 5000,
    },
    createdAt: new Date('2025-11-27T08:00:00Z'),
    createdBy: 'user-123',
  },
  {
    id: 'ver-002',
    pfaId: 'PFA-001',
    version: 2,
    data: {
      forecastStart: new Date('2025-11-15'),
      forecastEnd: new Date('2025-12-20'),
      monthlyRate: 5000,
    },
    createdAt: new Date('2025-11-28T10:01:00Z'),
    createdBy: 'user-123',
    reason: 'Updated forecast dates based on PM review',
  },
];

// Mock PFA modifications with sync status
export const mockPfaModifications: PfaModification[] = [
  {
    id: 'mod-001',
    mirrorId: 'mirror-001',
    organizationId: 'org-rio',
    userId: 'user-123',
    delta: {
      forecastStart: new Date('2025-12-01'),
      forecastEnd: new Date('2025-12-31'),
    },
    syncState: 'draft',
    baseVersion: 1,
    currentVersion: 1,
    modifiedFields: ['forecastStart', 'forecastEnd'],
    createdAt: new Date('2025-11-28T08:00:00Z'),
    updatedAt: new Date('2025-11-28T08:30:00Z'),
  },
  {
    id: 'mod-002',
    mirrorId: 'mirror-002',
    organizationId: 'org-rio',
    userId: 'user-456',
    delta: {
      monthlyRate: 7500,
      category: 'Heavy Equipment',
    },
    syncState: 'committed',
    baseVersion: 2,
    currentVersion: 2,
    modifiedFields: ['monthlyRate', 'category'],
    changeReason: 'Rate increase per vendor contract',
    committedAt: new Date('2025-11-28T11:00:00Z'),
    createdAt: new Date('2025-11-28T10:00:00Z'),
    updatedAt: new Date('2025-11-28T11:00:00Z'),
  },
  {
    id: 'mod-003',
    mirrorId: 'mirror-003',
    organizationId: 'org-portarthur',
    userId: 'user-789',
    delta: {
      forecastStart: new Date('2026-01-15'),
    },
    syncState: 'syncing',
    baseVersion: 1,
    currentVersion: 1,
    modifiedFields: ['forecastStart'],
    createdAt: new Date('2025-11-28T14:00:00Z'),
    updatedAt: new Date('2025-11-28T14:01:00Z'),
  },
  {
    id: 'mod-004',
    mirrorId: 'mirror-004',
    organizationId: 'org-rio',
    userId: 'user-123',
    delta: {
      forecastEnd: new Date('2025-11-30'),
    },
    syncState: 'sync_error',
    baseVersion: 3,
    currentVersion: 3,
    modifiedFields: ['forecastEnd'],
    createdAt: new Date('2025-11-28T09:00:00Z'),
    updatedAt: new Date('2025-11-28T09:15:30Z'),
  },
];

// Mock API functions (to be replaced in Phase 3)
export const mockFetchSyncJobs = async (filters?: {
  organizationId?: string;
  status?: SyncJobStatus;
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<SyncJob[]> => {
  await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay

  let results = [...mockSyncJobs];

  if (filters?.organizationId) {
    results = results.filter(job => job.organizationId === filters.organizationId);
  }

  if (filters?.status) {
    results = results.filter(job => job.status === filters.status);
  }

  if (filters?.dateFrom) {
    results = results.filter(job => job.startedAt >= filters.dateFrom!);
  }

  if (filters?.dateTo) {
    results = results.filter(job => job.startedAt <= filters.dateTo!);
  }

  return results;
};

export const mockResolveConflict = async (data: {
  jobId: string;
  conflictId: string;
  strategy: ConflictResolutionStrategy;
  chosenValue?: unknown;
}): Promise<{ success: boolean; message: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const job = mockSyncJobs.find(j => j.id === data.jobId);
  if (!job) {
    throw new Error('Sync job not found');
  }

  const conflict = job.conflicts.find(c => c.id === data.conflictId);
  if (!conflict) {
    throw new Error('Conflict not found');
  }

  conflict.resolved = true;
  conflict.resolution = data.strategy;
  conflict.chosenValue = data.chosenValue;

  return {
    success: true,
    message: 'Conflict resolved successfully',
  };
};

export const mockRollback = async (data: {
  pfaId: string;
  versionId: string;
  reason: string;
}): Promise<{ success: boolean; message: string }> => {
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (!data.reason || data.reason.length < 10) {
    throw new Error('Rollback reason must be at least 10 characters');
  }

  return {
    success: true,
    message: `Successfully rolled back PFA ${data.pfaId} to version ${data.versionId}`,
  };
};

export const mockFetchSyncHistory = async (
  pfaId: string
): Promise<SyncHistory[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockSyncHistory.filter(h => h.pfaId === pfaId);
};

export const mockFetchRollbackVersions = async (
  pfaId: string
): Promise<RollbackVersion[]> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  return mockRollbackVersions.filter(v => v.pfaId === pfaId);
};
