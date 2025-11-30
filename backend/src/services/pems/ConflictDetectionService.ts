/**
 * Conflict Detection Service
 *
 * Detects version conflicts between local modifications and PEMS mirror.
 * Performs field-level diff to identify conflicting changes.
 *
 * Phase 2, Track A - Task 2A.3: Conflict Detection Service
 */

import prisma from '../../config/database';
import { logger } from '../../utils/logger';

export interface ConflictResult {
  hasConflict: boolean;
  conflict?: {
    id: string;
    pfaId: string;
    localVersion: number;
    pemsVersion: number;
    conflictFields: string[];
    localData: any;
    pemsData: any;
  };
  canAutoMerge: boolean;
}

export class ConflictDetectionService {
  /**
   * Detect conflicts between a modification and the current mirror state
   */
  async detectConflict(
    modificationId: string
  ): Promise<ConflictResult> {
    logger.info('Detecting conflicts for modification', { modificationId });

    try {
      // Get modification record
      const modification = await prisma.pfa_modification.findUnique({
        where: { id: modificationId },
        include: {
          pfa_mirror: true
        }
      });

      if (!modification) {
        throw new Error(`Modification ${modificationId} not found`);
      }

      const mirror = modification.pfa_mirror;

      // No conflict if modification is based on current mirror version
      if (modification.baseVersion >= mirror.version) {
        logger.info('No version conflict detected', {
          modificationId,
          baseVersion: modification.baseVersion,
          mirrorVersion: mirror.version
        });

        return {
          hasConflict: false,
          canAutoMerge: true
        };
      }

      // Version mismatch - check field-level conflicts
      logger.warn('Version mismatch detected - checking field conflicts', {
        modificationId,
        baseVersion: modification.baseVersion,
        mirrorVersion: mirror.version
      });

      const modifiedFields = Object.keys(modification.delta as any);

      // Get mirror changes since modification's base version
      const mirrorChanges = await this.getMirrorChanges(
        mirror.id,
        modification.baseVersion,
        mirror.version
      );

      // Identify conflicting fields (fields modified in both local and mirror)
      const conflictFields = modifiedFields.filter(field =>
        mirrorChanges.includes(field)
      );

      // No field-level conflicts - can auto-merge
      if (conflictFields.length === 0) {
        logger.info('Non-overlapping changes - can auto-merge', {
          modificationId,
          modifiedFields,
          mirrorChanges
        });

        return {
          hasConflict: false,
          canAutoMerge: true
        };
      }

      // Create conflict record
      const conflict = await prisma.pfa_sync_conflict.create({
        data: {
          id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          pfaId: mirror.pfaId || 'UNKNOWN',
          organizationId: modification.organizationId,
          modificationId: modification.id,
          localVersion: modification.baseVersion,
          pemsVersion: mirror.version,
          localData: modification.delta as any,
          pemsData: mirror.data as any,
          conflictFields: conflictFields,
          status: 'unresolved'
        }
      });

      logger.warn('Conflict created - user resolution required', {
        conflictId: conflict.id,
        pfaId: mirror.pfaId,
        conflictFields
      });

      return {
        hasConflict: true,
        conflict: {
          id: conflict.id,
          pfaId: mirror.pfaId || 'UNKNOWN',
          localVersion: modification.baseVersion,
          pemsVersion: mirror.version,
          conflictFields,
          localData: modification.delta,
          pemsData: mirror.data
        },
        canAutoMerge: false
      };

    } catch (error) {
      logger.error('Failed to detect conflict', {
        modificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get list of fields changed in mirror between two versions
   */
  private async getMirrorChanges(
    mirrorId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<string[]> {
    // Get history records for the version range
    const historyRecords = await prisma.pfa_mirror_history.findMany({
      where: {
        mirrorId,
        version: {
          gte: fromVersion + 1, // Changes after base version
          lte: toVersion
        }
      },
      orderBy: {
        version: 'asc'
      }
    });

    if (historyRecords.length === 0) {
      return [];
    }

    // Compare first record with last to get all changed fields
    const oldestRecord = historyRecords[0];
    const newestRecord = historyRecords[historyRecords.length - 1];

    const changedFields: string[] = [];
    const oldData = oldestRecord.data as any;
    const newData = newestRecord.data as any;

    // Check each field for changes
    const allFields = new Set([
      ...Object.keys(oldData || {}),
      ...Object.keys(newData || {})
    ]);

    for (const field of allFields) {
      if (this.hasFieldChanged(oldData[field], newData[field])) {
        changedFields.push(field);
      }
    }

    logger.debug('Mirror changes detected', {
      mirrorId,
      fromVersion,
      toVersion,
      changedFields
    });

    return changedFields;
  }

  /**
   * Check if a field value has changed (deep comparison for objects)
   */
  private hasFieldChanged(oldValue: any, newValue: any): boolean {
    // Handle null/undefined
    if (oldValue === null || oldValue === undefined) {
      return newValue !== null && newValue !== undefined;
    }
    if (newValue === null || newValue === undefined) {
      return true;
    }

    // Handle dates
    if (oldValue instanceof Date && newValue instanceof Date) {
      return oldValue.getTime() !== newValue.getTime();
    }

    // Handle primitives
    if (typeof oldValue !== 'object' && typeof newValue !== 'object') {
      return oldValue !== newValue;
    }

    // Handle objects/arrays (JSON comparison)
    return JSON.stringify(oldValue) !== JSON.stringify(newValue);
  }

  /**
   * Resolve a conflict by applying the specified resolution
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'use_local' | 'use_pems' | 'merge',
    mergedData?: any,
    resolvedBy?: string
  ): Promise<void> {
    logger.info('Resolving conflict', {
      conflictId,
      resolution,
      resolvedBy
    });

    const conflict = await prisma.pfa_sync_conflict.findUnique({
      where: { id: conflictId },
      include: {
        modification: {
          include: {
            pfa_mirror: true
          }
        }
      }
    });

    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    if (conflict.status !== 'unresolved') {
      throw new Error(`Conflict ${conflictId} is already ${conflict.status}`);
    }

    let finalData: any;

    switch (resolution) {
      case 'use_local':
        // Keep local changes, discard PEMS changes
        finalData = conflict.localData;
        break;

      case 'use_pems':
        // Discard local changes, keep PEMS changes
        // Mark modification as synced with current PEMS version
        await prisma.pfa_modification.update({
          where: { id: conflict.modificationId },
          data: {
            syncStatus: 'synced',
            syncedAt: new Date(),
            baseVersion: conflict.pemsVersion,
            currentVersion: conflict.pemsVersion
          }
        });
        finalData = null; // No need to sync
        break;

      case 'merge':
        // Use user-provided merged data
        if (!mergedData) {
          throw new Error('Merged data required for merge resolution');
        }
        finalData = mergedData;
        break;

      default:
        throw new Error(`Invalid resolution type: ${resolution}`);
    }

    // Update conflict record
    await prisma.pfa_sync_conflict.update({
      where: { id: conflictId },
      data: {
        status: 'resolved',
        resolution,
        mergedData: finalData,
        resolvedBy,
        resolvedAt: new Date()
      }
    });

    // Update modification with resolved data
    if (finalData && resolution !== 'use_pems') {
      await prisma.pfa_modification.update({
        where: { id: conflict.modificationId },
        data: {
          delta: finalData,
          syncState: 'pending_sync',
          baseVersion: conflict.pemsVersion // Update to current PEMS version
        }
      });

      // Re-queue for sync
      await prisma.pfa_write_queue.create({
        data: {
          id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          modificationId: conflict.modificationId,
          pfaId: conflict.pfaId,
          organizationId: conflict.organizationId,
          operation: 'update',
          payload: finalData,
          status: 'pending',
          scheduledAt: new Date()
        }
      });
    }

    logger.info('Conflict resolved successfully', {
      conflictId,
      resolution,
      requeued: !!finalData && resolution !== 'use_pems'
    });
  }

  /**
   * Get all unresolved conflicts for an organization
   */
  async getUnresolvedConflicts(
    organizationId: string
  ): Promise<any[]> {
    const conflicts = await prisma.pfa_sync_conflict.findMany({
      where: {
        organizationId,
        status: 'unresolved'
      },
      include: {
        modification: {
          include: {
            pfa_mirror: true,
            users: {
              select: {
                id: true,
                username: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return conflicts.map((conflict: any) => ({
      id: conflict.id,
      pfaId: conflict.pfaId,
      localVersion: conflict.localVersion,
      pemsVersion: conflict.pemsVersion,
      conflictFields: conflict.conflictFields,
      localData: conflict.localData,
      pemsData: conflict.pemsData,
      createdAt: conflict.createdAt,
      modifiedBy: {
        id: conflict.modification.users.id,
        username: conflict.modification.users.username,
        email: conflict.modification.users.email
      }
    }));
  }
}

export const conflictDetectionService = new ConflictDetectionService();
