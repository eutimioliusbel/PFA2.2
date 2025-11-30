// backend/src/middleware/auditContext.ts
/**
 * Audit Context Middleware
 *
 * Phase 6, Task 6.5 of ADR-005 Multi-Tenant Access Control
 *
 * Injects audit context into every request for AI data hooks.
 * Captures IP, User-Agent, Session ID for security analysis.
 *
 * Performance: < 1ms overhead per request (no async operations)
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Audit context data structure
 */
export interface AuditContextData {
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  organizationContext?: string;
  requestId?: string;
  timestamp: Date;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      auditContext?: AuditContextData;
    }
  }
}

/**
 * Extract client IP address from request
 * Handles proxied requests (X-Forwarded-For, X-Real-IP)
 */
function getClientIP(req: Request): string {
  // Check for proxy headers first
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs; first is client
    const ips = typeof xForwardedFor === 'string'
      ? xForwardedFor.split(',')
      : xForwardedFor;
    return ips[0].trim();
  }

  const xRealIP = req.headers['x-real-ip'];
  if (xRealIP) {
    return typeof xRealIP === 'string' ? xRealIP : xRealIP[0];
  }

  // Fall back to direct connection IP
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Generate unique request ID for correlation
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Injects audit context into request
 *
 * Usage:
 * ```typescript
 * app.use(injectAuditContext);
 * // Later in controller:
 * const { ipAddress, userAgent, sessionId } = req.auditContext;
 * ```
 */
export function injectAuditContext(req: Request, res: Response, next: NextFunction): void {
  // Generate request ID for correlation
  const requestId = generateRequestId();

  // Inject audit context
  req.auditContext = {
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    sessionId: req.headers['x-session-id'] as string || undefined,
    organizationContext: (req as any).user?.organizationId,
    requestId,
    timestamp: new Date(),
  };

  // Add request ID to response headers for client-side correlation
  res.setHeader('X-Request-ID', requestId);

  next();
}

/**
 * Extract audit context from request (for use in controllers)
 *
 * Returns safe default values if context is not available
 */
export function getAuditContext(req: Request): AuditContextData {
  return req.auditContext || {
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    timestamp: new Date(),
  };
}

/**
 * Create audit context from raw data (for background jobs)
 */
export function createAuditContext(data: Partial<AuditContextData>): AuditContextData {
  return {
    ipAddress: data.ipAddress || 'system',
    userAgent: data.userAgent || 'background-job',
    sessionId: data.sessionId,
    organizationContext: data.organizationContext,
    requestId: data.requestId || generateRequestId(),
    timestamp: data.timestamp || new Date(),
  };
}

export default injectAuditContext;
