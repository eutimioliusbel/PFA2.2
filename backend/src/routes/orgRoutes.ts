import express from 'express';
import {
  getOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from '../controllers/orgController';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// All organization routes require authentication
router.use(authenticateJWT);

// GET /api/organizations - Get all organizations
router.get('/', getOrganizations);

// POST /api/organizations - Create new organization
router.post('/', createOrganization);

// PUT /api/organizations/:id - Update organization
router.put('/:id', updateOrganization);

// DELETE /api/organizations/:id - Delete organization
router.delete('/:id', deleteOrganization);

export default router;
