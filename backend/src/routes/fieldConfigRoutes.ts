import express from 'express';
import {
  getFieldConfigurations,
  getFieldConfiguration,
  createFieldConfiguration,
  updateFieldConfiguration,
  deleteFieldConfiguration
} from '../controllers/fieldConfigController';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

// Get all field configurations
router.get('/', getFieldConfigurations);

// Get a specific field configuration
router.get('/:id', getFieldConfiguration);

// Create a new field configuration
router.post('/', createFieldConfiguration);

// Update a field configuration
router.put('/:id', updateFieldConfiguration);

// Delete a field configuration
router.delete('/:id', deleteFieldConfiguration);

export default router;
