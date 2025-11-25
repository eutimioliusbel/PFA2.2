/**
 * Data Source Mapping Routes
 */

import { Router } from 'express';
import {
  getAllMappings,
  getMapping,
  getMappingMetrics,
  createMapping,
  updateMapping,
  deleteMapping,
  getActiveDataSource,
  getMappingsForEntity,
  syncEntityData
} from '../controllers/dataSourceController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// Mapping CRUD
router.get('/mappings', getAllMappings);
router.get('/mappings/:id', getMapping);
router.get('/mappings/:id/metrics', getMappingMetrics);
router.post('/mappings', createMapping);
router.patch('/mappings/:id', updateMapping);
router.delete('/mappings/:id', deleteMapping);

// Entity-specific queries
router.get('/entity-types/:entityType/active', getActiveDataSource);
router.get('/entity-types/:entityType/mappings', getMappingsForEntity);

// Sync operations
router.post('/sync', syncEntityData);

export default router;
