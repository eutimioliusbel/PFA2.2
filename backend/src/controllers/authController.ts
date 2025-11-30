import { Request, Response } from 'express';
import authService from '../services/auth/authService';
import { logger as _logger } from '../utils/logger';
import { handleControllerError } from '../utils/errorHandling';

export class AuthController {
  /**
   * POST /api/auth/login
   * Authenticate user and return JWT token
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Username and password required' });
        return;
      }

      const result = await authService.login(username, password);

      res.json(result);
    } catch (error: unknown) {
      handleControllerError(error, res, 'AuthController.login');
    }
  }

  /**
   * POST /api/auth/register
   * Create new user (admin only - handled by middleware)
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, password, email, firstName, lastName, role } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Username and password required' });
        return;
      }

      const user = await authService.createUser({
        username,
        password,
        email,
        firstName,
        lastName,
        role,
      });

      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error: unknown) {
      handleControllerError(error, res, 'AuthController.register');
    }
  }

  /**
   * POST /api/auth/verify
   * Verify JWT token and return full user data
   */
  async verify(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Token required' });
        return;
      }

      // Verify token and get payload
      const payload = authService.verifyToken(token);

      // Fetch full user data from database
      const user = await authService.getUserById(payload.userId);

      if (!user) {
        res.status(401).json({ valid: false, error: 'USER_NOT_FOUND', message: 'User not found' });
        return;
      }

      res.json({ valid: true, user });
    } catch (error) {
      res.status(401).json({ valid: false, error: 'INVALID_TOKEN', message: 'Token is invalid or expired' });
    }
  }
}

export default new AuthController();
