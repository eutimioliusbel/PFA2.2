import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { globalRateLimiter } from './middleware/rateLimiter';

// Routes
import authRoutes from './routes/authRoutes';
import aiRoutes from './routes/aiRoutes';

const app = express();

// ============================================================================
// Middleware
// ============================================================================

// CORS
app.use(cors({
  origin: env.CORS_ORIGIN.split(',').map(o => o.trim()),
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Global rate limiting
app.use('/api', globalRateLimiter);

// ============================================================================
// Routes
// ============================================================================

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint not found' });
});

// Error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

// ============================================================================
// Server Startup
// ============================================================================

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Start server
    app.listen(env.PORT, () => {
      logger.info(`
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   🚀 PFA Vanguard Backend API Server                      │
│                                                            │
│   Environment: ${env.NODE_ENV.padEnd(43)}│
│   Port:        ${env.PORT.toString().padEnd(43)}│
│   Database:    Connected ✓                                │
│                                                            │
│   Endpoints:                                               │
│   • GET  /health           - Health check                 │
│   • POST /api/auth/login   - User login                   │
│   • POST /api/ai/chat      - AI chat (requires auth)      │
│   • GET  /api/ai/usage     - AI usage stats               │
│                                                            │
│   Documentation: See README.md                             │
│                                                            │
└────────────────────────────────────────────────────────────┘
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Start the server
startServer();

export default app;
