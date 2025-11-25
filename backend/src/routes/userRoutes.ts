import express from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/userController';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// All user routes require authentication
router.use(authenticateJWT);

// GET /api/users - Get all users
router.get('/', getUsers);

// POST /api/users - Create new user
router.post('/', createUser);

// PUT /api/users/:id - Update user
router.put('/:id', updateUser);

// DELETE /api/users/:id - Delete user
router.delete('/:id', deleteUser);

export default router;
