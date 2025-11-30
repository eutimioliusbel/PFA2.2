/**
 * PEMS Screen Controller
 *
 * Handles direct PEMS screen operations via UserDefinedScreenService API.
 * Provides test endpoints and direct PFA record operations.
 *
 * Endpoints:
 * - GET /api/pems/screen/test - Test connection and write capability
 * - GET /api/pems/screen/record/:pfaId - Get single PFA record from PEMS
 * - PUT /api/pems/screen/record/:pfaId - Update PFA record in PEMS
 * - POST /api/pems/screen/record - Create new PFA record in PEMS
 */

import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import { logger } from '../utils/logger';
import { pemsScreenService, PFA_TO_PEMS_FIELD_MAP } from '../services/pems/PemsScreenService';
import { z } from 'zod';

// Validation schemas
const UpdatePfaSchema = z.object({
  organization: z.string(),
  updates: z.record(z.any())
});

const CreatePfaSchema = z.object({
  organization: z.string(),
  data: z.record(z.any())
});

/**
 * GET /api/pems/screen/test
 * Test PEMS UserDefinedScreenService connection and write capability
 */
export const testPemsScreen = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    logger.info('Testing PEMS Screen Service connection', { userId: req.user?.userId });

    // Test 1: Connection test (GET)
    const connectionTest = await pemsScreenService.testConnection();

    // Test 2: Write capability test (only if connection works)
    let writeTest: { canWrite: boolean; error?: string } = { canWrite: false, error: 'Skipped - connection failed' };
    if (connectionTest.success) {
      writeTest = await pemsScreenService.testWriteCapability('83772', 'RIO');
    }

    res.status(200).json({
      success: connectionTest.success,
      connection: {
        success: connectionTest.success,
        latencyMs: connectionTest.latencyMs,
        error: connectionTest.error
      },
      writeCapability: {
        enabled: writeTest.canWrite,
        error: writeTest.error
      },
      screenName: 'CUPFA2',
      supportedActions: ['GET', 'ADD', 'UPDATE', 'DELETE'],
      fieldMappingCount: Object.keys(PFA_TO_PEMS_FIELD_MAP).length,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('PEMS Screen Service test failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'TEST_FAILED',
      message: error.message
    });
  }
};

/**
 * GET /api/pems/screen/record/:pfaId
 * Get a single PFA record directly from PEMS
 */
export const getPfaRecord = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { pfaId } = req.params;
    const { organization } = req.query;

    if (!pfaId) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'pfaId is required'
      });
      return;
    }

    logger.info('Fetching PFA record from PEMS', { pfaId, organization });

    const record = await pemsScreenService.getPfaRecord(
      pfaId,
      organization as string | undefined
    );

    if (!record) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: `PFA record ${pfaId} not found in PEMS`
      });
      return;
    }

    res.status(200).json({
      success: true,
      source: 'pems',
      pfaId,
      record,
      fetchedAt: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Failed to fetch PFA record from PEMS', { error: error.message });
    res.status(500).json({
      error: 'FETCH_FAILED',
      message: error.message
    });
  }
};

/**
 * PUT /api/pems/screen/record/:pfaId
 * Update a PFA record in PEMS
 */
export const updatePfaRecord = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { pfaId } = req.params;
    const { organization, updates } = UpdatePfaSchema.parse(req.body);

    // Verify user has Sync permission for the organization
    const orgPermissions = req.user?.organizations.find(
      org => org.organizationCode === organization
    )?.permissions;

    if (!orgPermissions?.perm_Sync) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Sync permission required to update PEMS records'
      });
      return;
    }

    logger.info('Updating PFA record in PEMS', {
      pfaId,
      organization,
      userId: req.user?.userId,
      fieldsToUpdate: Object.keys(updates)
    });

    const result = await pemsScreenService.updatePfaRecord(pfaId, organization, updates);

    if (!result.success) {
      res.status(500).json({
        error: 'UPDATE_FAILED',
        message: result.error,
        pfaId
      });
      return;
    }

    res.status(200).json({
      success: true,
      pfaId,
      recordId: result.recordId,
      updatedAt: new Date().toISOString()
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: error.errors
      });
      return;
    }

    logger.error('Failed to update PFA record in PEMS', { error: error.message });
    res.status(500).json({
      error: 'UPDATE_FAILED',
      message: error.message
    });
  }
};

/**
 * POST /api/pems/screen/record
 * Create a new PFA record in PEMS
 */
export const createPfaRecord = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { organization, data } = CreatePfaSchema.parse(req.body);

    // Verify user has Sync permission for the organization
    const orgPermissions = req.user?.organizations.find(
      org => org.organizationCode === organization
    )?.permissions;

    if (!orgPermissions?.perm_Sync) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Sync permission required to create PEMS records'
      });
      return;
    }

    logger.info('Creating PFA record in PEMS', {
      organization,
      userId: req.user?.userId,
      fieldsProvided: Object.keys(data)
    });

    const result = await pemsScreenService.createPfaRecord(organization, data);

    if (!result.success) {
      res.status(500).json({
        error: 'CREATE_FAILED',
        message: result.error
      });
      return;
    }

    res.status(201).json({
      success: true,
      pfaId: result.pfaId,
      recordId: result.recordId,
      createdAt: new Date().toISOString()
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: error.errors
      });
      return;
    }

    logger.error('Failed to create PFA record in PEMS', { error: error.message });
    res.status(500).json({
      error: 'CREATE_FAILED',
      message: error.message
    });
  }
};

/**
 * DELETE /api/pems/screen/record/:pfaId
 * Delete a PFA record in PEMS
 */
export const deletePfaRecord = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { pfaId } = req.params;
    const { organization } = req.body;

    if (!organization) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'organization is required'
      });
      return;
    }

    // Verify user has Delete permission for the organization
    const orgPermissions = req.user?.organizations.find(
      org => org.organizationCode === organization
    )?.permissions;

    if (!orgPermissions?.perm_Delete) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Delete permission required to delete PEMS records'
      });
      return;
    }

    logger.info('Deleting PFA record in PEMS', {
      pfaId,
      organization,
      userId: req.user?.userId
    });

    const result = await pemsScreenService.deletePfaRecord(pfaId, organization);

    if (!result.success) {
      res.status(500).json({
        error: 'DELETE_FAILED',
        message: result.error,
        pfaId
      });
      return;
    }

    res.status(200).json({
      success: true,
      pfaId,
      deletedAt: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Failed to delete PFA record in PEMS', { error: error.message });
    res.status(500).json({
      error: 'DELETE_FAILED',
      message: error.message
    });
  }
};

/**
 * GET /api/pems/screen/field-mapping
 * Get the field mapping between PFA Vanguard and PEMS
 */
export const getFieldMapping = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  res.status(200).json({
    mapping: PFA_TO_PEMS_FIELD_MAP,
    totalFields: Object.keys(PFA_TO_PEMS_FIELD_MAP).length,
    screenName: 'CUPFA2'
  });
};

/**
 * POST /api/pems/screen/batch-update
 * Batch update multiple PFA records in PEMS (sequential processing)
 */
export const batchUpdatePfaRecords = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'updates array is required'
      });
      return;
    }

    if (updates.length > 100) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Maximum 100 records per batch'
      });
      return;
    }

    // Verify user has Sync permission for all organizations in the batch
    const organizations = [...new Set(updates.map((u: any) => u.organization))];
    for (const org of organizations) {
      const orgPermissions = req.user?.organizations.find(
        o => o.organizationCode === org
      )?.permissions;

      if (!orgPermissions?.perm_Sync) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: `Sync permission required for organization: ${org}`
        });
        return;
      }
    }

    logger.info('Batch updating PFA records in PEMS', {
      userId: req.user?.userId,
      count: updates.length,
      organizations
    });

    const result = await pemsScreenService.batchUpdatePfaRecords(
      updates.map((u: any) => ({
        pfaId: u.pfaId,
        organization: u.organization,
        changes: u.changes
      }))
    );

    res.status(200).json({
      success: result.failed === 0,
      total: result.total,
      successful: result.successful,
      failed: result.failed,
      errors: result.errors,
      completedAt: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Failed to batch update PFA records in PEMS', { error: error.message });
    res.status(500).json({
      error: 'BATCH_UPDATE_FAILED',
      message: error.message
    });
  }
};
