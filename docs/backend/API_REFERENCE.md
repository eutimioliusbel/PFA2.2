# Backend API Reference

**Version**: 2.1
**Last Updated**: 2025-11-28
**Base URL (Development)**: `http://localhost:3001/api`
**Base URL (Production)**: `https://api.pfavanguard.com/api`

---

## Quick Navigation

- [Authentication](#authentication) - Login, verify token, register users
- [Authorization](#authorization--permissions) - Permission model and AI explanations
- [User Management](#user-management) - CRUD users, suspend/activate
- [Organization Management](#organization-management) - CRUD organizations, service control
- [User Permissions](#user-organization-permissions) - Assign roles, manage capabilities
- [AI Features](#ai-features) - Permission suggestions, statistics
- [Bronze Layer Ingestion](#bronze-layer-ingestion-adr-007) - PEMS data ingestion to Bronze layer
- [API Servers](#api-server-management) - External API integrations
- [Schema Drift & Mapping Versions](#schema-drift--mapping-versions) - Schema change detection and version management
- [PEMS Integration](#pems-integration) - Data synchronization
- [Audit Logging](#audit--logging) - View audit trails
- [Error Codes](#error-codes) - Error handling reference

---

## Authentication

All protected endpoints require JWT authentication:

```http
Authorization: Bearer <token>
```

### Login

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "user_001",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "serviceStatus": "active",
    "organizations": [
      {
        "id": "org_001",
        "code": "HOLNG",
        "role": "admin",
        "perm_Read": true,
        "perm_Write": true,
        "perm_Delete": true
      }
    ]
  }
}
```

**Rate Limit:** 5 requests/15 minutes per IP

**Errors:**
- `401` - Invalid credentials
- `403` - User suspended
- `429` - Rate limit exceeded

---

## Authorization & Permissions

### Permission Flags (14 total)

| Flag | Description | Risk |
|------|-------------|------|
| `perm_Read` | View data | Low |
| `perm_Write` | Modify data | Medium |
| `perm_Delete` | Delete records | High |
| `perm_ManageUsers` | Assign permissions | High |
| `perm_ManageSettings` | Org settings | High |
| `perm_RefreshData` | Trigger sync | Medium |
| `perm_ViewFinancials` | Financial data | Medium |
| `perm_ViewAllOrgs` | All organizations | Critical |
| `perm_Impersonate` | Act as another user | Critical |
| `perm_ViewAuditLog` | Audit logs | Medium |
| `perm_Export` | Export data | Low |
| `perm_Import` | Import data | High |
| `perm_ManageBEO` | BEO classifications | Medium |
| `perm_ManageAssets` | Asset master | Medium |

### Role Templates

| Role | Permissions |
|------|-------------|
| `viewer` | Read + ViewFinancials |
| `editor` | viewer + Write + RefreshData + Export |
| `admin` | All permissions |

---

## User Management

### List Users

**Endpoint:** `GET /api/users?organizationId={id}`

**Permission:** `perm_ManageUsers` OR admin

**Response:** Array of users with organization memberships

---

### Create User

**Endpoint:** `POST /api/users`

**Permission:** `perm_ManageUsers`

**Request:**
```json
{
  "username": "jsmith",
  "password": "SecurePass123!",
  "email": "jsmith@example.com",
  "organizationId": "org_001",
  "role": "editor",
  "metadata": {
    "jobTitle": "Project Manager",
    "department": "Engineering"
  }
}
```

**Response (201):** Created user with initial permissions

---

### Suspend User

**Endpoint:** `POST /api/users/:id/suspend`

**Permission:** `perm_ManageUsers`

**Request:**
```json
{
  "reason": "Security violation",
  "organizationId": "org_001"
}
```

**Effects:**
- Cannot login
- Existing sessions invalidated
- Audit trail preserved

---

## Organization Management

### List Organizations

**Endpoint:** `GET /api/organizations`

**Permission:** `perm_Read`

**Response:** Organizations user has access to

---

### Suspend Organization

**Endpoint:** `POST /api/organizations/:id/suspend`

**Permission:** `perm_ManageSettings`

**Request:**
```json
{
  "reason": "Project on hold"
}
```

**Effects:**
- All users lose access
- PEMS sync disabled
- Hidden from org list
- Audit trail preserved

---

## User-Organization Permissions

### Assign User to Organization

**Endpoint:** `POST /api/users/:userId/organizations`

**Permission:** `perm_ManageUsers`

**Request:**
```json
{
  "organizationId": "org_001",
  "role": "editor"
}
```

**Response (201):** User-organization assignment with permissions from role template

---

### Update Specific Permissions

**Endpoint:** `PATCH /api/user-organizations/:id/capabilities`

**Permission:** `perm_ManageUsers`

**Request:**
```json
{
  "capabilities": {
    "perm_Delete": true,
    "perm_ViewFinancials": false
  },
  "organizationId": "org_001"
}
```

**Response:** Updated permissions (granular control)

---

## AI Features

### Get Permission Suggestions

**Endpoint:** `POST /api/ai/suggest-permissions`

**Permission:** `perm_ManageUsers`

**Request:**
```json
{
  "userId": "user_004",
  "organizationId": "org_001",
  "metadata": {
    "jobTitle": "Project Manager",
    "department": "Engineering",
    "role": "editor"
  }
}
```

**Response:**
```json
{
  "suggestedPermissions": { ... },
  "confidence": 0.92,
  "reasoning": "Based on 85 similar PMs...",
  "basedOnUsers": 85,
  "securityWarnings": [
    {
      "permission": "perm_ViewFinancials",
      "severity": "medium",
      "message": "Requires proper clearance"
    }
  ]
}
```

---

## Bronze Layer Ingestion (ADR-007)

Bronze layer ingestion endpoints for triggering PEMS data sync to immutable Bronze records.

### Start Ingestion

**Endpoint:** `POST /api/ingestion/ingest`

**Permission:** `perm_Sync`

**Request:**
```json
{
  "endpointId": "endpoint-uuid",
  "syncType": "full"  // or "delta"
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "syncBatchId": "batch-1732800000000-endpoint",
  "endpointId": "endpoint-uuid",
  "syncType": "full",
  "message": "Ingestion started. Use GET /api/ingestion/:batchId/progress to track progress."
}
```

### Get Ingestion Progress

**Endpoint:** `GET /api/ingestion/:batchId/progress`

**Permission:** `perm_Read`

**Response (200):**
```json
{
  "syncBatchId": "batch-1732800000000-endpoint",
  "status": "running",
  "organizationId": "org-1",
  "endpointId": "endpoint-1",
  "entityType": "PFA",
  "totalRecords": 10000,
  "processedRecords": 5000,
  "currentPage": 5,
  "totalPages": 10,
  "startedAt": "2025-11-28T10:00:00Z"
}
```

**Status Values:** `running`, `completed`, `failed`

### Get Ingestion Status

**Endpoint:** `GET /api/ingestion/:batchId/status`

**Permission:** `perm_Read`

**Response (200):**
```json
{
  "syncBatchId": "batch-1732800000000-endpoint",
  "organizationId": "org-1",
  "endpointId": "endpoint-1",
  "entityType": "PFA",
  "recordCount": 10000,
  "validRecordCount": 10000,
  "invalidRecordCount": 0,
  "ingestedAt": "2025-11-28T10:00:00Z",
  "completedAt": "2025-11-28T10:05:00Z",
  "syncType": "full",
  "schemaFingerprint": {
    "fields": ["id", "cost", "category"],
    "types": {"id": "string", "cost": "number", "category": "string"}
  },
  "warnings": [],
  "errors": [],
  "endpoint": {
    "name": "PEMS PFA Read API",
    "entity": "PFA"
  }
}
```

### Get Ingestion History

**Endpoint:** `GET /api/ingestion/history`

**Permission:** `perm_Read`

**Query Parameters:**
- `organizationId` (optional) - Filter by organization
- `endpointId` (optional) - Filter by endpoint
- `limit` (optional) - Number of results (default 20, max 100)
- `offset` (optional) - Pagination offset (default 0)

**Response (200):**
```json
{
  "batches": [
    {
      "syncBatchId": "batch-1732800000000-endpoint",
      "organizationId": "org-1",
      "endpointId": "endpoint-1",
      "entityType": "PFA",
      "recordCount": 10000,
      "ingestedAt": "2025-11-28T10:00:00Z",
      "completedAt": "2025-11-28T10:05:00Z",
      "syncType": "full",
      "endpoint": {
        "name": "PEMS PFA Read API",
        "entity": "PFA"
      }
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

### Get Bronze Records

**Endpoint:** `GET /api/ingestion/records/:syncBatchId`

**Permission:** `perm_Read`

**Query Parameters:**
- `limit` (optional) - Number of results (default 10, max 100)
- `offset` (optional) - Pagination offset (default 0)

**Response (200):**
```json
{
  "syncBatchId": "batch-1732800000000-endpoint",
  "records": [
    {
      "id": "bronze-record-1",
      "syncBatchId": "batch-1732800000000-endpoint",
      "organizationId": "org-1",
      "entityType": "PFA",
      "ingestedAt": "2025-11-28T10:00:00Z",
      "rawJson": {
        "id": "PFA-001",
        "cost": 5000,
        "category": "Equipment"
      },
      "schemaVersion": "abc123"
    }
  ],
  "total": 10000,
  "limit": 10,
  "offset": 0
}
```

---

## PEMS Integration

Bi-directional synchronization endpoints for syncing local PFA modifications back to PEMS (ADR-008 Phase 4).

### Trigger Manual Write Sync

**Endpoint:** `POST /api/pems/write-sync`

**Permission:** `perm_Sync`

**Description:** Manually triggers a write sync to PEMS for all pending modifications in the specified organization. Queues all uncommitted modifications for sync.

**Request:**
```json
{
  "organizationId": "org-rio"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Write sync triggered successfully",
  "queueSize": 12,
  "batchId": "sync-1732800000000"
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Write sync already in progress",
  "queueSize": 45
}
```

**Errors:**
- `400` - Invalid organization ID
- `403` - User lacks `perm_Sync` permission
- `500` - Sync worker not running

### Get Sync Status

**Endpoint:** `GET /api/pems/sync-status`

**Permission:** `perm_Read`

**Description:** Returns current sync status for an organization, including queue size, last sync details, and pending conflicts.

**Query Parameters:**
- `organizationId` (required) - Organization to check sync status

**Response (200):**
```json
{
  "organizationId": "org-rio",
  "queueSize": 12,
  "pendingModifications": 12,
  "processingCount": 2,
  "failedCount": 1,
  "completedToday": 145,
  "lastSync": {
    "id": "sync-1732800000000",
    "completedAt": "2025-11-28T14:30:00Z",
    "duration": 45000,
    "recordsProcessed": 23,
    "recordsSucceeded": 22,
    "recordsFailed": 1,
    "status": "completed"
  },
  "conflicts": {
    "unresolved": 3,
    "autoResolved": 5,
    "manualResolved": 2
  },
  "workerHealth": {
    "running": true,
    "lastHeartbeat": "2025-11-28T14:35:00Z"
  }
}
```

### Get Queue Metrics

**Endpoint:** `GET /api/pems/queue-metrics`

**Permission:** `perm_Read`

**Description:** Returns detailed metrics about the write sync queue across all organizations.

**Response (200):**
```json
{
  "pending": 45,
  "processing": 3,
  "failed": 7,
  "completed24h": 1245,
  "avgLatencyMs": 2340,
  "successRate": 99.4,
  "byOrganization": {
    "org-rio": {
      "pending": 12,
      "processing": 1,
      "failed": 2
    },
    "org-portarthur": {
      "pending": 33,
      "processing": 2,
      "failed": 5
    }
  },
  "byOperation": {
    "update": 38,
    "create": 5,
    "delete": 2
  }
}
```

### Get Sync Logs

**Endpoint:** `GET /api/pems/sync-logs`

**Permission:** `perm_Read`

**Description:** Returns historical sync logs for audit and troubleshooting.

**Query Parameters:**
- `organizationId` (optional) - Filter by organization
- `status` (optional) - Filter by status: `completed`, `failed`, `running`
- `limit` (optional) - Number of results (default 20, max 100)
- `offset` (optional) - Pagination offset (default 0)

**Response (200):**
```json
{
  "logs": [
    {
      "id": "sync-1732800000000",
      "organizationId": "org-rio",
      "triggeredByUserId": "user-admin",
      "syncType": "manual",
      "syncDirection": "write",
      "batchId": "batch-1732800000000",
      "status": "completed",
      "recordsTotal": 23,
      "recordsProcessed": 23,
      "recordsInserted": 2,
      "recordsUpdated": 20,
      "recordsDeleted": 1,
      "recordsSkipped": 0,
      "recordsErrored": 0,
      "startedAt": "2025-11-28T14:30:00Z",
      "completedAt": "2025-11-28T14:30:45Z",
      "durationMs": 45000
    }
  ],
  "total": 156,
  "limit": 20,
  "offset": 0
}
```

### Get Sync Conflicts

**Endpoint:** `GET /api/pems/conflicts`

**Permission:** `perm_Read`

**Description:** Returns unresolved and recently resolved sync conflicts.

**Query Parameters:**
- `organizationId` (optional) - Filter by organization
- `status` (optional) - Filter by status: `unresolved`, `auto_resolved`, `manual_resolved`
- `limit` (optional) - Number of results (default 20, max 100)

**Response (200):**
```json
{
  "conflicts": [
    {
      "id": "conflict-abc123",
      "pfaId": "PFA-001-RIO",
      "organizationId": "org-rio",
      "modificationId": "mod-xyz789",
      "localVersion": 3,
      "pemsVersion": 5,
      "conflictFields": ["forecastStart", "forecastEnd"],
      "localData": {
        "forecastStart": "2025-06-01",
        "forecastEnd": "2025-08-31"
      },
      "pemsData": {
        "forecastStart": "2025-06-15",
        "forecastEnd": "2025-09-15"
      },
      "status": "unresolved",
      "createdAt": "2025-11-28T14:30:00Z",
      "detectionStrategy": "version_mismatch"
    }
  ],
  "summary": {
    "unresolved": 3,
    "autoResolved": 5,
    "manualResolved": 2
  }
}
```

### Resolve Conflict

**Endpoint:** `POST /api/pems/conflicts/:conflictId/resolve`

**Permission:** `perm_Sync`

**Description:** Manually resolves a sync conflict by choosing local, remote, or merged data.

**Request:**
```json
{
  "resolution": "use_local",  // or "use_remote" or "merge"
  "mergedData": {             // required if resolution = "merge"
    "forecastStart": "2025-06-15",
    "forecastEnd": "2025-08-31"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "conflictId": "conflict-abc123",
  "resolution": "use_local",
  "resolvedAt": "2025-11-28T14:45:00Z",
  "resolvedBy": "user-admin",
  "requeuedForSync": true
}
```

**Errors:**
- `404` - Conflict not found
- `400` - Invalid resolution strategy
- `409` - Conflict already resolved

### WebSocket: Real-Time Sync Updates

**Endpoint:** `WS /ws/sync-status`

**Description:** WebSocket endpoint for real-time sync progress updates.

**Authentication:** Send JWT token in first message after connection:

```json
{
  "type": "auth",
  "token": "eyJhbGc..."
}
```

**Subscribe to Organization:**

```json
{
  "type": "subscribe",
  "organizationId": "org-rio"
}
```

**Server Messages:**

```json
{
  "type": "queue_update",
  "organizationId": "org-rio",
  "queueSize": 10,
  "timestamp": "2025-11-28T14:30:00Z"
}
```

```json
{
  "type": "sync_progress",
  "organizationId": "org-rio",
  "batchId": "sync-1732800000000",
  "processed": 15,
  "total": 23,
  "status": "running"
}
```

```json
{
  "type": "sync_complete",
  "organizationId": "org-rio",
  "batchId": "sync-1732800000000",
  "success": 22,
  "failed": 1,
  "duration": 45000
}
```

```json
{
  "type": "conflict_detected",
  "organizationId": "org-rio",
  "conflictId": "conflict-abc123",
  "pfaId": "PFA-001-RIO",
  "fields": ["forecastStart", "forecastEnd"]
}
```

### Rate Limiting

All PEMS sync endpoints are rate-limited:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/pems/write-sync` | 10 requests | 1 minute |
| `GET /api/pems/sync-status` | 60 requests | 1 minute |
| `GET /api/pems/queue-metrics` | 60 requests | 1 minute |
| `GET /api/pems/sync-logs` | 30 requests | 1 minute |
| `GET /api/pems/conflicts` | 30 requests | 1 minute |

**Rate Limit Headers:**

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1732800060
```

**429 Response:**

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 45
}
```

---

## Schema Drift & Mapping Versions

### Get Schema Drift Analysis

**Endpoint:** `GET /api/endpoints/:endpointId/schema-drift`

**Permission:** `perm_Read`

**Description:** Analyzes schema drift between the last two Bronze batches for an endpoint, detecting missing fields, new fields, and type changes. Returns AI-powered mapping suggestions.

**Response (200):**
```json
{
  "drift": {
    "hasDrift": true,
    "missingFields": ["id", "cost"],
    "newFields": ["equipment_id", "monthly_cost"],
    "changedTypes": {
      "status": { "was": "string", "now": "number" }
    },
    "severity": "high",
    "metrics": {
      "baselineFieldCount": 25,
      "newFieldCount": 28,
      "missingPercent": 8.0,
      "addedCount": 3,
      "typeChangeCount": 1
    }
  },
  "baseline": {
    "fields": ["id", "name", "cost", "status", ...],
    "capturedAt": "2025-11-28T10:00:00Z",
    "batchId": "batch_xyz"
  },
  "received": {
    "fields": ["equipment_id", "name", "monthly_cost", "status", ...],
    "capturedAt": "2025-11-28T12:00:00Z",
    "batchId": "batch_abc"
  },
  "suggestions": [
    {
      "sourceField": "equipment_id",
      "destinationField": "id",
      "confidence": 0.95,
      "reason": "Field name similarity (Levenshtein distance: 2)"
    }
  ]
}
```

### Get Mapping Versions

**Endpoint:** `GET /api/endpoints/:endpointId/mapping-versions`

**Permission:** `perm_Read`

**Description:** Returns all historical mapping version snapshots for an endpoint.

**Response (200):**
```json
{
  "versions": [
    {
      "id": "version_2025-11-28T10:00:00.000Z",
      "version": 3,
      "validFrom": "2025-11-28T10:00:00Z",
      "validTo": null,
      "createdBy": "user_xyz",
      "mappingCount": 25,
      "isActive": true
    },
    {
      "id": "version_2025-11-20T08:00:00.000Z",
      "version": 2,
      "validFrom": "2025-11-20T08:00:00Z",
      "validTo": "2025-11-28T10:00:00Z",
      "createdBy": "user_abc",
      "mappingCount": 22,
      "isActive": false
    }
  ]
}
```

### Get Mapping Version Detail

**Endpoint:** `GET /api/endpoints/:endpointId/mapping-versions/:versionId`

**Permission:** `perm_Read`

**Description:** Returns all field mappings for a specific version snapshot.

**Response (200):**
```json
{
  "mappings": [
    {
      "id": "mapping_abc",
      "sourceField": "udf_char_01",
      "destinationField": "category",
      "transformType": "uppercase",
      "dataType": "string",
      "isActive": true,
      "validFrom": "2025-11-28T10:00:00Z",
      "validTo": null
    }
  ]
}
```

### Create Mappings (Batch)

**Endpoint:** `POST /api/endpoints/:endpointId/mappings/batch`

**Permission:** `perm_ManageSettings`

**Description:** Creates multiple field mappings at once (used for applying drift suggestions).

**Request:**
```json
{
  "mappings": [
    {
      "sourceField": "equipment_id",
      "destinationField": "id",
      "transformType": "direct",
      "dataType": "string"
    },
    {
      "sourceField": "monthly_cost",
      "destinationField": "monthlyRate",
      "transformType": "direct",
      "dataType": "number"
    }
  ]
}
```

**Response (200):**
```json
{
  "created": 2,
  "failed": 0,
  "mappings": [...]
}
```

### Restore Mapping Version

**Endpoint:** `POST /api/endpoints/:endpointId/mapping-versions/:versionId/restore`

**Permission:** `perm_ManageSettings`

**Description:** Restores a historical mapping version by deactivating current mappings and creating new ones based on the historical snapshot.

**Response (200):**
```json
{
  "restored": 22,
  "mappings": [...]
}
```

**Errors:**
- `404` - Version not found or endpoint has no historical mappings

---

## Error Codes

| Status | Code | Resolution |
|--------|------|------------|
| 400 | `VALIDATION_ERROR` | Check request format |
| 401 | `UNAUTHORIZED` | Login required |
| 401 | `TOKEN_EXPIRED` | Re-login |
| 403 | `INSUFFICIENT_PERMISSIONS` | Contact admin |
| 403 | `USER_SUSPENDED` | Contact admin |
| 404 | `NOT_FOUND` | Check resource ID |
| 429 | `RATE_LIMIT_EXCEEDED` | Wait before retry |

---

**Full Documentation:** See [Complete API Reference](./API_REFERENCE_COMPLETE.md) for detailed endpoint documentation with all request/response examples.

**Related:** [ARCHITECTURE.md](../ARCHITECTURE.md), [ADMIN_GUIDE.md](../user/ADMIN_GUIDE.md), [USER_GUIDE.md](../user/USER_GUIDE.md)
