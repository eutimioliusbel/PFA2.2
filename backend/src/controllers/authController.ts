import { Request, Response } from 'express';
import authService from '../services/auth/authService';
import { logger } from '../utils/logger';

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
    } catch (error: any) {
      logger.error('Login controller error:', error);

      if (error.message === 'Invalid credentials' || error.message === 'Account is inactive') {
        res.status(401).json({ error: 'AUTHENTICATION_FAILED', message: error.message });
      } else {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Login failed' });
      }
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
    } catch (error: any) {
      logger.error('Register controller error:', error);

      if (error.code === 'P2002') { // Prisma unique constraint violation
        res.status(409).json({ error: 'USER_EXISTS', message: 'Username already exists' });
      } else {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Registration failed' });
      }
    }
  }

  /**
   * POST /api/auth/verify
   * Verify JWT token
   */
  async verify(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Token required' });
        return;
      }

      const payload = authService.verifyToken(token);

      res.json({ valid: true, payload });
    } catch (error) {
      res.status(401).json({ valid: false, error: 'INVALID_TOKEN', message: 'Token is invalid or expired' });
    }
  }
}

export default new AuthController();
