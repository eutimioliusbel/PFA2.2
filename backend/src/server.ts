import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { globalRateLimiter } from './middleware/rateLimiter';
import { injectAuditContext } from './middleware/auditContext';
import { initializeWorker } from './workers/PemsSyncWorker';
import { initializeCronJobs, stopCronJobs } from './services/cron/cronScheduler';
import { SyncWebSocketServer } from './services/websocket/SyncWebSocketServer';

// Routes
import authRoutes from './routes/authRoutes';
import aiRoutes from './routes/aiRoutes';
import pemsRoutes from './routes/pemsRoutes';
import pemsWriteSyncRoutes from './routes/pemsWriteSyncRoutes';  // ADR-008: Bi-directional PEMS sync
import apiConfigRoutes from './routes/apiConfigRoutes';
import fieldConfigRoutes from './routes/fieldConfigRoutes';
import logRoutes from './routes/logRoutes';
import userRoutes from './routes/userRoutes';
import userOrgRoutes from './routes/userOrgRoutes';
import orgRoutes from './routes/orgRoutes';
import syncRoutes from './routes/syncRoutes';
import pfaDataRoutes from './routes/pfaDataRoutes';
import assetMasterRoutes from './routes/assetMasterRoutes';  // Asset Master Data
import apiServerRoutes from './routes/apiServers';
import auditRoutes from './routes/auditRoutes';
import beoRoutes from './routes/beoRoutes';
import permissionRoutes from './routes/permissionRoutes';
import financialRoutes from './routes/financialRoutes';
import roleDriftRoutes from './routes/roleDriftRoutes';
import notificationRoutes from './routes/notificationRoutes';
import lineageRoutes from './routes/lineageRoutes';  // ADR-007: Data lineage & Bronze inspector
import ingestionRoutes from './routes/ingestionRoutes';  // ADR-007: Bronze layer ingestion
import mappingRoutes from './routes/mappingRoutes';  // ADR-007: Field mapping configuration (Mapping Studio)
import mappingTemplateRoutes from './routes/mappingTemplateRoutes';  // ADR-007: Mapping templates (save/load)
import fieldMappingRoutes from './routes/fieldMappingRoutes';  // Field mappings for api_field_mappings table
import kpiRoutes from './routes/kpiRoutes';  // ADR-007: KPI Calculator & Formula Builder
import roleTemplateRoutes from './routes/roleTemplateRoutes';  // ADR-005: Role Template Editor
import personalAccessTokenRoutes from './routes/personalAccessTokenRoutes';  // ADR-005: PAT Management
import sessionRoutes from './routes/sessionRoutes';  // ADR-005: Session Manager
import webhookRoutes from './routes/webhookRoutes';  // ADR-005: Integrations Hub
import systemDictionaryRoutes from './routes/systemDictionaryRoutes';  // ADR-005: System Dictionary Editor
import trashCanRoutes from './routes/trashCanRoutes';  // ADR-005: Trash Can (Soft Delete Management)
import syncStatusRoutes from './routes/syncStatusRoutes';  // ADR-007: Sync Status Dashboard (Real-time job monitoring)
import masterDataRoutes from './routes/masterDataRoutes';  // Master Data: Manufacturers, Models, DORs, Sources, Classifications

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
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Audit context injection (for AI data hooks)
app.use(injectAuditContext);

// Global rate limiting
app.use('/api', globalRateLimiter);

// ============================================================================
// Routes
// ============================================================================

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/pems', pemsRoutes);
app.use('/api/pems', pemsWriteSyncRoutes);  // ADR-008: Bi-directional PEMS sync (write operations)
app.use('/api/configs', apiConfigRoutes);
app.use('/api/field-configs', fieldConfigRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/users', userRoutes);
app.use('/api', userOrgRoutes);  // User-organization routes (includes /users/:id/organizations and /user-organizations/:id)
app.use('/api/organizations', orgRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/pfa', pfaDataRoutes);
app.use('/api/assets', assetMasterRoutes);  // Asset Master Data
app.use('/api/audit', auditRoutes);  // Audit logging (pre-flight reviews, bypasses)
app.use('/api', apiServerRoutes);  // Two-tier API architecture (servers + endpoints)
app.use('/api/beo', beoRoutes);  // BEO Glass Mode (portfolio health, priority items)
app.use('/api/permissions', permissionRoutes);  // Permission explanation routes (AI-powered denial explanations)
app.use('/api/financial', financialRoutes);  // Financial data masking routes (relative indicators for non-privileged users)
app.use('/api/roles', roleDriftRoutes);  // Role drift detection routes (detect patterns, apply refactors)
app.use('/api/notifications', notificationRoutes);  // Notification timing routes (behavioral quiet mode)
app.use(lineageRoutes);  // ADR-007: Data lineage, Bronze inspector, orphan detection
app.use('/api/ingestion', ingestionRoutes);  // ADR-007: Bronze layer ingestion (PEMS -> Bronze Records)
app.use(mappingRoutes);  // ADR-007: Field mapping configuration (Mapping Studio)
app.use(mappingTemplateRoutes);  // ADR-007: Mapping templates (save/load reusable configs)
app.use(fieldMappingRoutes);  // api_field_mappings CRUD (PEMS -> PFA transformations)
app.use('/api/kpis', kpiRoutes);  // ADR-007: KPI Calculator & Formula Builder
app.use('/api/role-templates', roleTemplateRoutes);  // ADR-005: Role Template Editor (The Matrix)
app.use('/api/tokens', personalAccessTokenRoutes);  // ADR-005: Personal Access Token Management
app.use('/api/sessions', sessionRoutes);  // ADR-005: Session Manager (Security Kill Switch)
app.use('/api/webhooks', webhookRoutes);  // ADR-005: Webhook Configuration (Integrations Hub)
app.use('/api/dictionary', systemDictionaryRoutes);  // ADR-005: System Dictionary Editor
app.use('/api/trash', trashCanRoutes);  // ADR-005: Trash Can (Data Recovery Console)
app.use('/api/sync', syncStatusRoutes);  // ADR-007: Sync Status Dashboard (Real-time batch job monitoring)
app.use('/api/master-data', masterDataRoutes);  // Master Data: Manufacturers, Models, DORs, Sources, Classifications

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint not found' });
});

// Error handler
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
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

    // Initialize background sync worker
    const workerEnabled = process.env.ENABLE_SYNC_WORKER === 'true';
    const syncInterval = process.env.SYNC_INTERVAL || '*/15 * * * *';
    const syncOrgs = process.env.SYNC_ORGS ? process.env.SYNC_ORGS.split(',').map(s => s.trim()) : [];

    const worker = initializeWorker({
      enabled: workerEnabled,
      syncInterval,
      organizations: syncOrgs
    });

    if (workerEnabled) {
      worker.start();
      logger.info(`[Worker] Background sync worker started (interval: ${syncInterval})`);
    } else {
      logger.info('[Worker] Background sync worker disabled');
    }

    // Initialize cron jobs (Bronze pruning, PEMS write sync, etc.)
    const enableCronJobs = process.env.ENABLE_CRON_JOBS !== 'false';
    if (enableCronJobs) {
      initializeCronJobs({
        enableBronzePruning: process.env.ENABLE_BRONZE_PRUNING !== 'false',
        bronzePruningSchedule: process.env.BRONZE_PRUNING_SCHEDULE || '0 2 * * *',
        bronzeRetentionDays: parseInt(process.env.BRONZE_RETENTION_DAYS || '90', 10),
        enableArchival: process.env.ENABLE_BRONZE_ARCHIVAL === 'true',
        enablePemsWriteSync: process.env.ENABLE_PEMS_WRITE_SYNC !== 'false',
        pemsWriteSyncSchedule: process.env.PEMS_WRITE_SYNC_SCHEDULE || '* * * * *',
      });
      logger.info('[Cron] Cron jobs initialized');
    } else {
      logger.info('[Cron] Cron jobs disabled');
    }

    // Start server
    const server = app.listen(env.PORT, () => {
      logger.info(`
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   🚀 PFA Vanguard Backend API Server                      │
│                                                            │
│   Environment: ${env.NODE_ENV.padEnd(43)}│
│   Port:        ${env.PORT.toString().padEnd(43)}│
│   Database:    Connected ✓                                │
│   Sync Worker: ${(workerEnabled ? 'Enabled ✓' : 'Disabled').padEnd(43)}│
│   WebSocket:   Enabled ✓                                  │
│                                                            │
│   Endpoints:                                               │
│   • GET  /health           - Health check                 │
│   • POST /api/auth/login   - User login                   │
│   • POST /api/ai/chat      - AI chat (requires auth)      │
│   • GET  /api/ai/usage     - AI usage stats               │
│   • POST /api/sync/trigger - Manual sync trigger          │
│   • GET  /api/sync/status  - Sync status & logs           │
│   • GET  /api/pfa/:orgId   - Get merged PFA data          │
│   • POST /api/pfa/:orgId/draft - Save draft changes       │
│   • WS   /api/ws/sync/:orgId - Real-time sync updates     │
│                                                            │
│   Documentation: See README.md                             │
│                                                            │
└────────────────────────────────────────────────────────────┘
      `);
    });

    // Initialize WebSocket server
    const syncWebSocketServer = new SyncWebSocketServer(server);
    logger.info('[WebSocket] Sync status WebSocket server initialized');

    // Export for use in other modules
    (global as any).syncWebSocketServer = syncWebSocketServer;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  const { getWorkerInstance } = await import('./workers/PemsSyncWorker');
  const worker = getWorkerInstance();
  if (worker) {
    worker.stop();
    logger.info('Background sync worker stopped');
  }
  stopCronJobs();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  const { getWorkerInstance } = await import('./workers/PemsSyncWorker');
  const worker = getWorkerInstance();
  if (worker) {
    worker.stop();
    logger.info('Background sync worker stopped');
  }
  stopCronJobs();
  process.exit(0);
});

// Start the server
startServer();

export default app;
