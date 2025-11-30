/**
 * PfaMirrorService - Business logic for Mirror + Delta architecture
 *
 * Handles:
 * - Querying merged views (PfaMirror + PfaModification)
 * - Saving user modifications (drafts)
 * - Committing changes
 * - Discarding drafts
 * - Providing PfaView objects to controllers
 */

import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { logger } from '../../utils/logger';

export interface PfaViewMetadata {
  mirrorId: string;
  hasModifications: boolean;
  syncState: 'pristine' | 'draft' | 'committed' | 'syncing' | 'sync_error';
  modifiedBy?: string;
  modifiedAt?: Date;
  modificationId?: string;
}

export interface PfaView {
  [key: string]: any;
  _metadata: PfaViewMetadata;
}

export interface SaveDraftParams {
  organizationId: string;
  userId: string;
  pfaId: string;
  delta: Record<string, any>;
  sessionId?: string;
  changeReason?: string;
}

export interface CommitDraftsParams {
  organizationId: string;
  userId: string;
  sessionId?: string;
  pfaIds?: string[];
}

export interface DiscardDraftsParams {
  organizationId: string;
  userId: string;
  sessionId?: string;
  pfaIds?: string[];
}

export class PfaMirrorService {

  /**
   * Get merged PFA data for an organization
   *
   * Returns PfaView objects with runtime merge of mirror + modifications
   * Uses PostgreSQL JSONB || operator for efficient merging
   */
  async getMergedViews(
    organizationId: string,
    userId?: string,
    filters?: {
      category?: string;
      class?: string;
      source?: string;
      dor?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<PfaView[]> {
    try {
      // Build WHERE clause for filters
      const whereClauses: string[] = [`m."organizationId" = '${organizationId}'`];

      if (filters?.category) {
        whereClauses.push(`m.category = '${filters.category}'`);
      }
      if (filters?.class) {
        whereClauses.push(`m.class = '${filters.class}'`);
      }
      if (filters?.source) {
        whereClauses.push(`m.source = '${filters.source}'`);
      }
      if (filters?.dor) {
        whereClauses.push(`m.dor = '${filters.dor}'`);
      }
      if (filters?.search) {
        whereClauses.push(`(
          m."pfaId" ILIKE '%${filters.search}%' OR
          m.data->>'manufacturer' ILIKE '%${filters.search}%' OR
          m.data->>'model' ILIKE '%${filters.search}%'
        )`);
      }

      const whereClause = whereClauses.join(' AND ');

      // Build merge query
      const query = `
        SELECT
          m.id AS "mirrorId",
          m."pfaId",
          (COALESCE(m.data, '{}'::jsonb) || COALESCE(mod.delta, '{}'::jsonb)) AS data,
          CASE
            WHEN mod."syncState" IS NOT NULL THEN mod."syncState"
            ELSE 'pristine'
          END AS "syncState",
          mod.id AS "modificationId",
          mod."updatedAt" AS "modifiedAt",
          mod."userId" AS "modifiedBy"
        FROM pfa_mirror m
        LEFT JOIN pfa_modification mod
          ON m.id = mod."mirrorId"
          AND mod."syncState" IN ('draft', 'committed', 'syncing')
          ${userId ? `AND mod."userId" = '${userId}'` : ''}
        WHERE ${whereClause}
        ORDER BY m."pfaId" ASC
        LIMIT ${filters?.limit || 1000}
        OFFSET ${filters?.offset || 0}
      `;

      // Execute raw query
      const results = await prisma.$queryRawUnsafe<any[]>(query);

      // Transform to PfaView objects
      const views: PfaView[] = results.map(row => ({
        ...row.data,
        _metadata: {
          mirrorId: row.mirrorId,
          hasModifications: row.modificationId !== null,
          syncState: row.syncState as any,
          modifiedBy: row.modifiedBy,
          modifiedAt: row.modifiedAt,
          modificationId: row.modificationId
        }
      }));

      return views;

    } catch (error) {
      logger.error('Failed to get merged views:', error);
      throw error;
    }
  }

  /**
   * Get total count of PFA records for an organization
   *
   * Efficient count query using the same filters as getMergedViews
   * Replaces array.length for better performance with large datasets
   */
  async getCount(
    organizationId: string,
    filters?: {
      category?: string;
      class?: string;
      source?: string;
      dor?: string;
      search?: string;
    }
  ): Promise<number> {
    try {
      // Build WHERE clause for filters (same as getMergedViews)
      const whereClauses: string[] = [`m."organizationId" = '${organizationId}'`];

      if (filters?.category) {
        whereClauses.push(`m.category = '${filters.category}'`);
      }
      if (filters?.class) {
        whereClauses.push(`m.class = '${filters.class}'`);
      }
      if (filters?.source) {
        whereClauses.push(`m.source = '${filters.source}'`);
      }
      if (filters?.dor) {
        whereClauses.push(`m.dor = '${filters.dor}'`);
      }
      if (filters?.search) {
        whereClauses.push(`(m."pfaId" ILIKE '%${filters.search}%' OR m.class ILIKE '%${filters.search}%')`);
      }

      const whereClause = whereClauses.join(' AND ');

      // Use COUNT() for efficient counting
      const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(*) as count
        FROM pfa_mirror m
        WHERE ${whereClause}
      `);

      return Number(result[0].count);

    } catch (error) {
      logger.error('Failed to get count:', error);
      throw error;
    }
  }

  /**
   * Save user modification (upsert to PfaModification)
   *
   * Creates or updates a draft modification for a specific PFA record
   */
  async saveDraft(params: SaveDraftParams): Promise<void> {
    const { organizationId, userId, pfaId, delta, sessionId, changeReason } = params;

    try {
      // Find the mirror record
      const mirror = await prisma.pfa_mirror.findFirst({
        where: {
          organizationId,
          pfaId
        }
      });

      if (!mirror) {
        throw new Error(`PfaMirror not found for pfaId: ${pfaId}`);
      }

      // Extract modified field names
      const modifiedFields = Object.keys(delta);

      // Check if modification already exists
      const existingMod = await prisma.pfa_modification.findFirst({
        where: {
          mirrorId: mirror.id,
          userId,
          syncState: 'draft'
        }
      });

      if (existingMod) {
        // Update existing draft
        await prisma.pfa_modification.update({
          where: { id: existingMod.id },
          data: {
            delta: delta as Prisma.InputJsonValue,
            modifiedFields: modifiedFields as Prisma.InputJsonValue,
            sessionId,
            changeReason,
            currentVersion: existingMod.currentVersion + 1,
            updatedAt: new Date()
          }
        });
      } else {
        // Create new draft
        await prisma.pfa_modification.create({
          data: {
            id: `mod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            mirrorId: mirror.id,
            organizationId,
            userId,
            delta: delta as Prisma.InputJsonValue,
            modifiedFields: modifiedFields as Prisma.InputJsonValue,
            sessionId,
            changeReason,
            syncState: 'draft',
            baseVersion: mirror.version,
            currentVersion: mirror.version,
            updatedAt: new Date()
          }
        });
      }

      logger.info('Draft saved successfully', { pfaId, userId });

    } catch (error) {
      logger.error('Failed to save draft:', error);
      throw error;
    }
  }

  /**
   * Commit draft modifications (mark as committed)
   *
   * Changes syncState from 'draft' to 'committed' for specified drafts
   */
  async commitDrafts(params: CommitDraftsParams): Promise<number> {
    const { organizationId, userId, sessionId, pfaIds } = params;

    try {
      // Build where clause
      const whereClause: any = {
        organizationId,
        userId,
        syncState: 'draft'
      };

      if (sessionId) {
        whereClause.sessionId = sessionId;
      }

      if (pfaIds && pfaIds.length > 0) {
        // Get mirror IDs for the specified pfaIds
        const mirrors = await prisma.pfa_mirror.findMany({
          where: {
            organizationId,
            pfaId: { in: pfaIds }
          },
          select: { id: true }
        });

        whereClause.mirrorId = { in: mirrors.map(m => m.id) };
      }

      // Update drafts to committed
      const result = await prisma.pfa_modification.updateMany({
        where: whereClause,
        data: {
          syncState: 'committed',
          committedAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('Drafts committed successfully', {
        count: result.count,
        userId,
        sessionId
      });

      return result.count;

    } catch (error) {
      logger.error('Failed to commit drafts:', error);
      throw error;
    }
  }

  /**
   * Discard draft modifications (delete)
   *
   * Permanently removes draft modifications from the database
   */
  async discardDrafts(params: DiscardDraftsParams): Promise<number> {
    const { organizationId, userId, sessionId, pfaIds } = params;

    try {
      // Build where clause
      const whereClause: any = {
        organizationId,
        userId,
        syncState: 'draft'
      };

      if (sessionId) {
        whereClause.sessionId = sessionId;
      }

      if (pfaIds && pfaIds.length > 0) {
        // Get mirror IDs for the specified pfaIds
        const mirrors = await prisma.pfa_mirror.findMany({
          where: {
            organizationId,
            pfaId: { in: pfaIds }
          },
          select: { id: true }
        });

        whereClause.mirrorId = { in: mirrors.map(m => m.id) };
      }

      // Delete drafts
      const result = await prisma.pfa_modification.deleteMany({
        where: whereClause
      });

      logger.info('Drafts discarded successfully', {
        count: result.count,
        userId,
        sessionId
      });

      return result.count;

    } catch (error) {
      logger.error('Failed to discard drafts:', error);
      throw error;
    }
  }

  /**
   * Get draft count for a user
   */
  async getDraftCount(organizationId: string, userId: string): Promise<number> {
    try {
      const count = await prisma.pfa_modification.count({
        where: {
          organizationId,
          userId,
          syncState: 'draft'
        }
      });

      return count;

    } catch (error) {
      logger.error('Failed to get draft count:', error);
      throw error;
    }
  }

  /**
   * Get modification history for a PFA record
   */
  async getModificationHistory(
    organizationId: string,
    pfaId: string
  ): Promise<any[]> {
    try {
      const mirror = await prisma.pfa_mirror.findFirst({
        where: { organizationId, pfaId }
      });

      if (!mirror) {
        return [];
      }

      const modifications = await prisma.pfa_modification.findMany({
        where: { mirrorId: mirror.id },
        orderBy: { createdAt: 'desc' },
        include: {
          users: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      return modifications;

    } catch (error) {
      logger.error('Failed to get modification history:', error);
      throw error;
    }
  }
}

export default new PfaMirrorService();
