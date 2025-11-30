/**
 * @file apiServers.ts
 * @description Express routes for API Server and Endpoint management
 * Implements two-tier architecture REST API (13 total endpoints)
 *
 * Security:
 * - All routes require JWT authentication (authenticateJWT middleware)
 * - API server management uses requireApiServerPermission middleware:
 *   - CREATE/UPDATE/DELETE: Requires perm_ManageSettings
 *   - TEST: Any organization member can test
 *   - GET: Filtered by user's organizations (in controller)
 * - API endpoint management requires perm_ManageSettings
 */

import { Router } from 'express';
import ApiServerController from '../controllers/apiServerController';
import ApiEndpointController from '../controllers/apiEndpointController';
import { authenticateJWT } from '../middleware/auth';
import { requirePermission, requirePermissionGlobal } from '../middleware/requirePermission';
import { requireApiServerPermission } from '../middleware/requireApiServerPermission';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// ============================================================================
// API SERVER MANAGEMENT (7 endpoints)
// ============================================================================

/**
 * POST /api/servers/test-connection
 * Test connection without saving (for form validation)
 *
 * Authorization: Any organization member can test
 * Organization ID: Body field 'organizationId' (required)
 * Organization Status: Must be active
 *
 * IMPORTANT: This route must come before /servers/:serverId
 */
router.post('/servers/test-connection', requireApiServerPermission, ApiServerController.testConnection);

/**
 * GET /api/servers
 * Get all API servers for authenticated user's organization
 *
 * Authorization: Filtered by user's accessible organizations (in controller)
 * Query Parameters:
 * - organizationId: string (optional) - Filter by specific organization
 *
 * Response: Array of API servers user has access to
 */
router.get('/servers', requireApiServerPermission, ApiServerController.getServers);

/**
 * GET /api/servers/:serverId
 * Get a single API server by ID
 *
 * Authorization: Filtered by user's accessible organizations (in controller)
 * Response: API server object (if user has access)
 */
router.get('/servers/:serverId', requireApiServerPermission, ApiServerController.getServerById);

/**
 * POST /api/servers
 * Create a new API server
 *
 * Required Permission: perm_ManageSettings
 * Organization ID: Body field 'organizationId' (required)
 * Organization Status: Must be active
 *
 * Request Body:
 * - organizationId: string (required)
 * - name: string (required) - Server name (e.g., "PEMS Production")
 * - baseUrl: string (required) - Base URL for API
 * - authType: string (required) - Authentication type
 * - authKeyEncrypted: string (optional) - Encrypted credentials
 * - authValueEncrypted: string (optional) - Encrypted credentials
 * - commonHeaders: string (optional) - JSON string of common headers
 *
 * Response: Created API server object
 */
router.post('/servers', requireApiServerPermission, ApiServerController.createServer);

/**
 * PUT /api/servers/:serverId
 * Update an existing API server
 *
 * Required Permission: perm_ManageSettings
 * Organization ID: Extracted from existing server
 * Organization Status: Must be active
 *
 * Request Body:
 * - name: string (optional)
 * - baseUrl: string (optional)
 * - authType: string (optional)
 * - authKeyEncrypted: string (optional)
 * - authValueEncrypted: string (optional)
 * - commonHeaders: string (optional)
 *
 * Response: Updated API server object
 */
router.put('/servers/:serverId', requireApiServerPermission, ApiServerController.updateServer);

/**
 * DELETE /api/servers/:serverId
 * Delete an API server (cascades to endpoints)
 *
 * Required Permission: perm_ManageSettings
 * Organization ID: Extracted from existing server
 *
 * Response: Success message
 */
router.delete('/servers/:serverId', requireApiServerPermission, ApiServerController.deleteServer);

/**
 * POST /api/servers/:serverId/test
 * Test all endpoints for a server
 *
 * Authorization: Any organization member can test
 * Organization ID: Extracted from existing server or body
 * Organization Status: Must be active (suspended orgs cannot test)
 *
 * Request Body:
 * - organizationId: string (optional) - Organization context (auto-extracted if not provided)
 *
 * Response: Test results for all endpoints
 */
router.post('/servers/:serverId/test', requireApiServerPermission, ApiServerController.testAllEndpoints);

// ============================================================================
// API ENDPOINT MANAGEMENT (8 endpoints)
// ============================================================================

/**
 * GET /api/api-endpoints
 * Get all endpoints for authenticated user's organizations
 * Used by Mapping Studio to populate endpoint selector dropdown
 *
 * Required Permission: perm_Read
 * Organization ID: Extracted from JWT token
 *
 * Response: Array of all endpoints user has access to
 */
router.get('/api-endpoints', requirePermissionGlobal('perm_Read'), ApiEndpointController.getAllEndpoints);

/**
 * GET /api/servers/:serverId/endpoints
 * Get all endpoints for a server
 *
 * Required Permission: perm_Read
 * Organization ID: Query parameter 'organizationId' (required)
 *
 * Query Parameters:
 * - organizationId: string (required) - Organization context
 *
 * Response: Array of endpoints for the server
 */
router.get('/servers/:serverId/endpoints', requirePermission('perm_Read'), ApiEndpointController.getEndpointsByServer);

/**
 * POST /api/servers/:serverId/endpoints
 * Create a new endpoint
 *
 * Required Permission: perm_ManageSettings
 * Organization ID: Body field 'organizationId' (required)
 *
 * Request Body:
 * - organizationId: string (required) - Organization context
 * - name: string (required) - Endpoint name (e.g., "Assets", "Users")
 * - path: string (required) - Endpoint path (e.g., "/assets")
 * - entity: string (required) - Data entity type
 * - operationType: string (optional) - 'read', 'write', 'read-write'
 * - customHeaders: string (optional) - JSON string of headers
 *
 * Response: Created endpoint object
 */
router.post('/servers/:serverId/endpoints', requirePermission('perm_ManageSettings'), ApiEndpointController.createEndpoint);

/**
 * GET /api/endpoints/:endpointId
 * Get a single endpoint by ID
 *
 * Required Permission: perm_Read
 * Organization ID: Query parameter 'organizationId' (required)
 *
 * Query Parameters:
 * - organizationId: string (required) - Organization context
 *
 * Response: Endpoint object
 */
router.get('/endpoints/:endpointId', requirePermission('perm_Read'), ApiEndpointController.getEndpointById);

/**
 * PUT /api/endpoints/:endpointId
 * Update an existing endpoint
 *
 * Required Permission: perm_ManageSettings
 * Organization ID: Body field 'organizationId' (required)
 *
 * Request Body:
 * - organizationId: string (required) - Organization context
 * - name: string (optional)
 * - path: string (optional)
 * - entity: string (optional)
 * - operationType: string (optional)
 * - customHeaders: string (optional)
 *
 * Response: Updated endpoint object
 */
router.put('/endpoints/:endpointId', requirePermission('perm_ManageSettings'), ApiEndpointController.updateEndpoint);

/**
 * DELETE /api/endpoints/:endpointId
 * Delete an endpoint
 *
 * Required Permission: perm_ManageSettings
 * Organization ID: Query parameter 'organizationId' (required)
 *
 * Query Parameters:
 * - organizationId: string (required) - Organization context
 *
 * Response: Success message
 */
router.delete('/endpoints/:endpointId', requirePermission('perm_ManageSettings'), ApiEndpointController.deleteEndpoint);

/**
 * POST /api/endpoints/:endpointId/test
 * Test a single endpoint
 *
 * Required Permission: perm_RefreshData (testing connectivity)
 * Organization ID: Body field 'organizationId' (required)
 *
 * Request Body:
 * - organizationId: string (required) - Organization context
 *
 * Response: Test result object
 */
router.post('/endpoints/:endpointId/test', requirePermission('perm_RefreshData'), ApiEndpointController.testEndpoint);

/**
 * GET /api/endpoints/:endpointId/test-results
 * Get test results for an endpoint
 *
 * Required Permission: perm_Read
 * Organization ID: Query parameter 'organizationId' (required)
 *
 * Query Parameters:
 * - organizationId: string (required) - Organization context
 * - limit: number (optional) - Max results to return
 *
 * Response: Array of test results
 */
router.get('/endpoints/:endpointId/test-results', requirePermission('perm_Read'), ApiEndpointController.getTestResults);

/**
 * GET /api/endpoints/:endpointId/latest-test
 * Get latest test result for an endpoint
 *
 * Required Permission: perm_Read
 * Organization ID: Query parameter 'organizationId' (required)
 *
 * Query Parameters:
 * - organizationId: string (required) - Organization context
 *
 * Response: Latest test result object
 */
router.get('/endpoints/:endpointId/latest-test', requirePermission('perm_Read'), ApiEndpointController.getLatestTest);

// ============================================================================
// RAW DATA FETCH & SYNC (4 endpoints) - Uses new api_servers architecture
// ============================================================================

/**
 * GET /api/endpoints/active-organizations
 * Get list of active organizations available for sync
 *
 * Required Permission: perm_Read
 *
 * Response: Array of { id, code, name } for orgs with enableSync=true and serviceStatus='active'
 *
 * IMPORTANT: This route must come before /endpoints/:endpointId routes
 */
router.get('/endpoints/active-organizations', requirePermission('perm_Read'), ApiEndpointController.getActiveOrganizations);

/**
 * POST /api/endpoints/:endpointId/fetch-raw
 * Fetch raw JSON data from PEMS without transformation
 *
 * Required Permission: perm_RefreshData
 * Organization ID: Body field 'serverId' (required)
 *
 * Request Body:
 * - serverId: string (required) - API server ID
 * - organizationCode: string (optional) - Filter by organization code (e.g., 'RIO')
 * - limit: number (optional) - Max records to fetch (default: 100)
 * - offset: number (optional) - Record offset for pagination (default: 0)
 * - includeRawResponse: boolean (optional) - Include full PEMS response structure
 *
 * Response: Raw JSON data from PEMS API
 */
router.post('/endpoints/:endpointId/fetch-raw', requirePermission('perm_RefreshData'), ApiEndpointController.fetchRawData);

/**
 * POST /api/endpoints/:endpointId/fetch-all
 * Fetch all pages of raw JSON data from PEMS
 *
 * Required Permission: perm_RefreshData
 *
 * Request Body:
 * - serverId: string (required) - API server ID
 * - organizationCode: string (optional) - Filter by organization code
 *
 * Response: All records (auto-paginates up to 100K safety limit)
 */
router.post('/endpoints/:endpointId/fetch-all', requirePermission('perm_RefreshData'), ApiEndpointController.fetchAllRawData);

/**
 * POST /api/endpoints/:endpointId/sync
 * Sync data from PEMS to database using new api_servers architecture
 *
 * Required Permission: perm_RefreshData
 *
 * Request Body:
 * - serverId: string (required) - API server ID
 * - organizationId: string (required) - Target organization UUID
 * - syncType: 'full' | 'incremental' (optional, default: 'full')
 *
 * Response: Sync progress with record counts
 */
router.post('/endpoints/:endpointId/sync', requirePermission('perm_RefreshData'), ApiEndpointController.syncEndpointData);

// ============================================================================
// SCHEMA DRIFT & MAPPING VERSIONS (5 endpoints)
// ============================================================================

/**
 * GET /api/endpoints/:endpointId/schema-drift
 * Analyze schema drift between last two batches
 *
 * Required Permission: perm_Read
 * Organization ID: Implicit from endpoint ownership
 *
 * Response: Schema drift analysis with mapping suggestions
 */
router.get('/endpoints/:endpointId/schema-drift', requirePermission('perm_Read'), ApiEndpointController.getSchemaDrift);

/**
 * GET /api/endpoints/:endpointId/mapping-versions
 * Get all mapping version snapshots for an endpoint
 *
 * Required Permission: perm_Read
 * Organization ID: Implicit from endpoint ownership
 *
 * Response: Array of mapping version snapshots
 */
router.get('/endpoints/:endpointId/mapping-versions', requirePermission('perm_Read'), ApiEndpointController.getMappingVersions);

/**
 * GET /api/endpoints/:endpointId/mapping-versions/:versionId
 * Get specific mapping version details
 *
 * Required Permission: perm_Read
 * Organization ID: Implicit from endpoint ownership
 *
 * Response: Array of field mappings for the version
 */
router.get('/endpoints/:endpointId/mapping-versions/:versionId', requirePermission('perm_Read'), ApiEndpointController.getMappingVersionDetail);

/**
 * POST /api/endpoints/:endpointId/mappings/batch
 * Create multiple field mappings at once (for applying suggestions)
 *
 * Required Permission: perm_ManageSettings
 * Organization ID: Implicit from endpoint ownership
 *
 * Request Body:
 * - mappings: Array of mapping objects with sourceField, destinationField, transformType, dataType
 *
 * Response: Creation results with created/failed counts
 */
router.post('/endpoints/:endpointId/mappings/batch', requirePermission('perm_ManageSettings'), ApiEndpointController.createMappingsBatch);

/**
 * POST /api/endpoints/:endpointId/mapping-versions/:versionId/restore
 * Restore a historical mapping version
 *
 * Required Permission: perm_ManageSettings
 * Organization ID: Implicit from endpoint ownership
 *
 * Response: Restored mapping count and mappings array
 */
router.post('/endpoints/:endpointId/mapping-versions/:versionId/restore', requirePermission('perm_ManageSettings'), ApiEndpointController.restoreMappingVersion);

export default router;
