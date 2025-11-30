import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { EventEmitter } from 'events';

interface SyncEvent {
  type: 'SYNC_QUEUED' | 'SYNC_PROCESSING' | 'SYNC_SUCCESS' | 'SYNC_CONFLICT' | 'SYNC_FAILED';
  pfaId: string;
  organizationId: string;
  timestamp: Date;
  details?: any;
}

export class SyncWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, Set<WebSocket>> = new Map(); // organizationId -> Set<WebSocket>
  // EventBus available for future pub/sub patterns
  public readonly eventBus: EventEmitter = new EventEmitter();

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/api/ws/sync'
    });

    this.wss.on('connection', (ws, req) => {
      const organizationId = this.extractOrgId(req.url);

      if (!organizationId) {
        ws.close(4000, 'Missing organizationId');
        return;
      }

      this.addClient(organizationId, ws);

      ws.on('close', () => {
        this.removeClient(organizationId, ws);
      });

      ws.on('error', (error) => {
        console.error(`[WebSocket] Error for org ${organizationId}:`, error);
      });

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        organizationId,
        timestamp: new Date(),
      }));
    });
  }

  private extractOrgId(url?: string): string | null {
    if (!url) return null;
    const match = url.match(/\/api\/ws\/sync\/([^?]+)/);
    return match ? match[1] : null;
  }

  private addClient(organizationId: string, ws: WebSocket) {
    if (!this.clients.has(organizationId)) {
      this.clients.set(organizationId, new Set());
    }
    this.clients.get(organizationId)!.add(ws);
    console.log(`[WebSocket] Client connected to org ${organizationId} (total: ${this.clients.get(organizationId)!.size})`);
  }

  private removeClient(organizationId: string, ws: WebSocket) {
    const orgClients = this.clients.get(organizationId);
    if (orgClients) {
      orgClients.delete(ws);
      if (orgClients.size === 0) {
        this.clients.delete(organizationId);
      }
    }
    console.log(`[WebSocket] Client disconnected from org ${organizationId}`);
  }

  broadcast(organizationId: string, event: SyncEvent) {
    const orgClients = this.clients.get(organizationId);
    if (!orgClients || orgClients.size === 0) {
      return; // No clients listening
    }

    const message = JSON.stringify(event);

    orgClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });

    console.log(`[WebSocket] Broadcast to ${orgClients.size} clients: ${event.type} for ${event.pfaId}`);
  }

  getConnectionCount(organizationId: string): number {
    return this.clients.get(organizationId)?.size || 0;
  }
}
