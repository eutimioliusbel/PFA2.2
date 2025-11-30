/**
 * API Configuration Controller (New Architecture)
 *
 * Handles global API configs and org-specific credentials:
 * - PEMS APIs: Global system-wide configs (admin-only)
 * - AI Providers: Global templates, orgs add their own API keys
 * - organization_api_credentials: Org-specific credentials for global configs
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';
import { handleControllerError } from '../utils/errorHandling';

/**
 * GET /api/configs
 * Get global API configurations and org-specific credentials
 */
export const getApiConfigs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.query;

    if (!organizationId || typeof organizationId !== 'string') {
      res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'organizationId is required'
      });
      return;
    }

    // Get all global API configurations (organizationId = null)
    const globalConfigs = await prisma.api_configurations.findMany({
      where: { organizationId: null },
      orderBy: { createdAt: 'desc' }
    });

    // Get org-specific credentials for these configs
    const orgCredentials = await prisma.organization_api_credentials.findMany({
      where: { organizationId },
      include: { api_configurations: true }
    });

    // Map org credentials by apiConfigurationId for quick lookup
    const credentialsMap = new Map(
      orgCredentials.map(cred => [cred.apiConfigurationId, cred])
    );

    // Combine global configs with org credentials
    const formattedConfigs = globalConfigs.map(config => {
      const orgCred = credentialsMap.get(config.id);
      const isPEMS = config.usage.startsWith('PEMS_');

      let decryptedAuth: any = {};

      // PEMS APIs: Always use global credentials (system-wide)
      // AI APIs: Prefer org credentials, fallback to global
      if (isPEMS) {
        // PEMS: Only use global credentials, never org-specific
        if (config.authKeyEncrypted || config.authValueEncrypted) {
          try {
            if (config.authKeyEncrypted) {
              decryptedAuth.username = decrypt(config.authKeyEncrypted);
            }
            if (config.authValueEncrypted) {
              if (config.authType === 'basic') {
                decryptedAuth.password = decrypt(config.authValueEncrypted);
              } else {
                decryptedAuth.apiKey = decrypt(config.authValueEncrypted);
              }
            }
            // Parse tenant, organization, gridCode, gridId from customHeaders in global config
            if (config.customHeaders) {
              try {
                const headers = JSON.parse(config.customHeaders);
                logger.info(`Parsing customHeaders for config ${config.id}:`, { customHeaders: config.customHeaders, headers });
                const tenantHeader = headers.find((h: any) => h.key === 'tenant');
                if (tenantHeader) decryptedAuth.tenant = tenantHeader.value;
                const orgHeader = headers.find((h: any) => h.key === 'organization');
                if (orgHeader) decryptedAuth.organization = orgHeader.value;
                const gridCodeHeader = headers.find((h: any) => h.key === 'gridCode');
                if (gridCodeHeader) decryptedAuth.gridCode = gridCodeHeader.value;
                const gridIdHeader = headers.find((h: any) => h.key === 'gridId');
                if (gridIdHeader) decryptedAuth.gridId = gridIdHeader.value;
                logger.info(`Extracted values:`, {
                  tenant: decryptedAuth.tenant,
                  organization: decryptedAuth.organization,
                  gridCode: decryptedAuth.gridCode,
                  gridId: decryptedAuth.gridId
                });
              } catch (e) {
                logger.warn('Failed to parse global custom headers:', e);
              }
            }
          } catch (error) {
            logger.error('Failed to decrypt global credentials:', error);
          }
        }
      } else {
        // AI: Check org credentials first, then global
        if (orgCred) {
          // Org has specific credentials
          try {
            if (orgCred.authKeyEncrypted) {
              decryptedAuth.username = decrypt(orgCred.authKeyEncrypted);
            }
            if (orgCred.authValueEncrypted) {
              if (config.authType === 'basic') {
                decryptedAuth.password = decrypt(orgCred.authValueEncrypted);
              } else {
                decryptedAuth.apiKey = decrypt(orgCred.authValueEncrypted);
              }
            }
            // Parse tenant from customHeaders
            if (orgCred.customHeaders) {
              try {
                const headers = JSON.parse(orgCred.customHeaders);
                const tenantHeader = headers.find((h: any) => h.key === 'tenant');
                if (tenantHeader) decryptedAuth.tenant = tenantHeader.value;
              } catch (e) {
                logger.warn('Failed to parse org custom headers:', e);
              }
            }
          } catch (error) {
            logger.error('Failed to decrypt org credentials:', error);
          }
        } else if (config.authKeyEncrypted || config.authValueEncrypted) {
          // No org credentials, use global as fallback
          try {
            if (config.authKeyEncrypted) {
              decryptedAuth.username = decrypt(config.authKeyEncrypted);
            }
            if (config.authValueEncrypted) {
              if (config.authType === 'basic') {
                decryptedAuth.password = decrypt(config.authValueEncrypted);
              } else {
                decryptedAuth.apiKey = decrypt(config.authValueEncrypted);
              }
            }
            // Parse tenant from customHeaders in global config
            if (config.customHeaders) {
              try {
                const headers = JSON.parse(config.customHeaders);
                const tenantHeader = headers.find((h: any) => h.key === 'tenant');
                if (tenantHeader) decryptedAuth.tenant = tenantHeader.value;
              } catch (e) {
                logger.warn('Failed to parse global custom headers:', e);
              }
            }
          } catch (error) {
            logger.error('Failed to decrypt global credentials:', error);
          }
        }
      }

      return {
        id: config.id,
        type: config.usage,
        name: config.name,
        url: config.url,
        authType: config.authType,
        username: decryptedAuth.username,
        password: decryptedAuth.password,
        apiKey: decryptedAuth.apiKey,
        tenant: decryptedAuth.tenant,
        organization: decryptedAuth.organization,
        gridCode: decryptedAuth.gridCode,
        gridId: decryptedAuth.gridId,
        hasCredentials: !!(decryptedAuth.username || decryptedAuth.apiKey),
        // PEMS: Use global status only, AI: Prefer org status
        status: isPEMS
          ? (config.status || 'unconfigured')
          : (orgCred?.status || config.status || 'unconfigured'),
        lastChecked: isPEMS
          ? config.lastChecked
          : (orgCred?.lastChecked || config.lastChecked),
        lastError: isPEMS ? null : orgCred?.lastError,
        operationType: config.operationType,
        feeds: config.feeds, // Data feeds configuration
        firstSyncAt: config.firstSyncAt,
        lastSyncAt: config.lastSyncAt,
        lastSyncRecordCount: config.lastSyncRecordCount,
        totalSyncRecordCount: config.totalSyncRecordCount,
        isGlobal: true, // Mark as global config
        isPEMS, // Flag to indicate PEMS (global-only credentials)
        credentialsConfigured: !!(config.authKeyEncrypted || config.authValueEncrypted) || !!orgCred
      };
    });

    res.json({ configs: formattedConfigs });
  } catch (error) {
    logger.error('Failed to fetch API configs:', error);
    res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to fetch API configurations'
    });
  }
};

/**
 * POST /api/configs/:id/credentials
 * Add or update org-specific credentials for a global API config
 */
export const upsertOrgCredentials = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // API configuration ID
    const {
      organizationId,
      username,
      password,
      apiKey,
      tenant
    } = req.body;

    // Validate
    if (!organizationId) {
      res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'organizationId is required'
      });
      return;
    }

    // Verify the API config exists and is global
    const apiConfig = await prisma.api_configurations.findUnique({
      where: { id }
    });

    if (!apiConfig) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'API configuration not found'
      });
      return;
    }

    if (apiConfig.organizationId !== null) {
      res.status(400).json({
        error: 'INVALID_CONFIG',
        message: 'This is not a global API configuration'
      });
      return;
    }

    // Encrypt credentials
    let authKeyEncrypted = null;
    let authValueEncrypted = null;

    if (apiConfig.authType === 'basic') {
      if (username) authKeyEncrypted = encrypt(username);
      if (password) authValueEncrypted = encrypt(password);
    } else if (apiConfig.authType === 'bearer' || apiConfig.authType === 'apiKey') {
      if (apiKey) authValueEncrypted = encrypt(apiKey);
    }

    // Store tenant in customHeaders as JSON
    let customHeaders = null;
    if (tenant) {
      customHeaders = JSON.stringify([{ key: 'tenant', value: tenant }]);
    }

    // Upsert org credentials
    const credentials = await prisma.organization_api_credentials.upsert({
      where: {
        organizationId_apiConfigurationId: {
          organizationId,
          apiConfigurationId: id
        }
      },
      update: {
        authKeyEncrypted,
        authValueEncrypted,
        customHeaders,
        status: 'untested', // Reset status on credential update
        updatedAt: new Date()
      },
      create: {
        organizationId,
        apiConfigurationId: id,
        authKeyEncrypted,
        authValueEncrypted,
        customHeaders,
        status: 'untested',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any
    });

    res.json({
      success: true,
      credentials: {
        id: credentials.id,
        status: credentials.status,
        lastChecked: credentials.lastChecked
      }
    });
  } catch (error) {
    logger.error('Failed to upsert org credentials:', error);
    res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to save credentials'
    });
  }
};

/**
 * DELETE /api/configs/:id/credentials
 * Remove org-specific credentials for a global API config
 */
export const deleteOrgCredentials = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { organizationId } = req.query;

    if (!organizationId || typeof organizationId !== 'string') {
      res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'organizationId is required'
      });
      return;
    }

    await prisma.organization_api_credentials.deleteMany({
      where: {
        organizationId,
        apiConfigurationId: id
      }
    });

    res.json({ success: true, message: 'Credentials removed' });
  } catch (error) {
    logger.error('Failed to delete org credentials:', error);
    res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to delete credentials'
    });
  }
};

/**
 * POST /api/configs/:id/test
 * Test an API configuration connection using org's credentials
 */
export const testApiConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { organizationId } = req.body;

    if (!organizationId) {
      res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'organizationId is required'
      });
      return;
    }

    // Fetch global config
    const config = await prisma.api_configurations.findUnique({
      where: { id }
    });

    if (!config) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'API configuration not found'
      });
      return;
    }

    const isPEMS = config.usage.startsWith('PEMS_');

    // Fetch org credentials (only for AI, not PEMS)
    const orgCred = !isPEMS ? await prisma.organization_api_credentials.findUnique({
      where: {
        organizationId_apiConfigurationId: {
          organizationId,
          apiConfigurationId: id
        }
      }
    }) : null;

    // Decrypt credentials
    // PEMS: Always use global credentials (system-wide)
    // AI: Prefer org credentials, fallback to global
    let username = null;
    let password = null;
    let apiKey = null;
    let tenant = null;
    let organization = null;

    try {
      if (isPEMS) {
        // PEMS: Only use global credentials
        if (!config.authKeyEncrypted && !config.authValueEncrypted) {
          res.status(404).json({
            error: 'NO_CREDENTIALS',
            message: 'No global credentials configured for this PEMS API'
          });
          return;
        }

        if (config.authKeyEncrypted) {
          username = decrypt(config.authKeyEncrypted);
        }
        if (config.authValueEncrypted) {
          if (config.authType === 'basic') {
            password = decrypt(config.authValueEncrypted);
          } else {
            apiKey = decrypt(config.authValueEncrypted);
          }
        }
        // Extract tenant and organization from global customHeaders
        if (config.customHeaders) {
          try {
            const headers = JSON.parse(config.customHeaders);
            const tenantHeader = headers.find((h: any) => h.key === 'tenant');
            if (tenantHeader) tenant = tenantHeader.value;
            const orgHeader = headers.find((h: any) => h.key === 'organization');
            if (orgHeader) organization = orgHeader.value;
          } catch (error) {
            logger.warn('Failed to parse global custom headers:', error);
          }
        }
      } else {
        // AI: Prefer org credentials, fallback to global
        if (orgCred) {
          // Use org-specific credentials
          if (orgCred.authKeyEncrypted) {
            username = decrypt(orgCred.authKeyEncrypted);
          }
          if (orgCred.authValueEncrypted) {
            if (config.authType === 'basic') {
              password = decrypt(orgCred.authValueEncrypted);
            } else {
              apiKey = decrypt(orgCred.authValueEncrypted);
            }
          }
          // Extract tenant from org customHeaders
          if (orgCred.customHeaders) {
            try {
              const headers = JSON.parse(orgCred.customHeaders);
              const tenantHeader = headers.find((h: any) => h.key === 'tenant');
              if (tenantHeader) tenant = tenantHeader.value;
            } catch (error) {
              logger.warn('Failed to parse org custom headers:', error);
            }
          }
        } else if (config.authKeyEncrypted || config.authValueEncrypted) {
          // Fallback to global credentials
          if (config.authKeyEncrypted) {
            username = decrypt(config.authKeyEncrypted);
          }
          if (config.authValueEncrypted) {
            if (config.authType === 'basic') {
              password = decrypt(config.authValueEncrypted);
            } else {
              apiKey = decrypt(config.authValueEncrypted);
            }
          }
          // Extract tenant from global customHeaders
          if (config.customHeaders) {
            try {
              const headers = JSON.parse(config.customHeaders);
              const tenantHeader = headers.find((h: any) => h.key === 'tenant');
              if (tenantHeader) tenant = tenantHeader.value;
            } catch (error) {
              logger.warn('Failed to parse global custom headers:', error);
            }
          }
        } else {
          // No credentials at all
          res.status(404).json({
            error: 'NO_CREDENTIALS',
            message: 'No credentials configured for this AI provider'
          });
          return;
        }
      }
    } catch (error) {
      logger.error('Failed to decrypt credentials:', error);
      res.status(500).json({
        error: 'ENCRYPTION_ERROR',
        message: 'Failed to decrypt stored credentials'
      });
      return;
    }

    // Test connection based on type
    const startTime = Date.now();
    let testResult: any = {
      success: false,
      message: '',
      latencyMs: 0
    };

    try {
      if (config.usage.startsWith('PEMS')) {
        // Test PEMS connection - branch based on API type
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        const headers: any = {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        };
        if (tenant) headers['tenant'] = tenant;
        if (organization) headers['organization'] = organization;

        let requestBody: any;
        let method = 'POST';
        let testUrl = config.url; // Use separate variable for test URL

        // Different request formats for different PEMS APIs
        if (config.usage === 'PEMS_PFA_READ') {
          // GridData API - uses complex grid request format
          // All values must come from customHeaders - no defaults
          let gridCode = null;
          let gridId = null;
          if (config.customHeaders) {
            try {
              const customHeaders = JSON.parse(config.customHeaders);
              const gridCodeHeader = customHeaders.find((h: any) => h.key === 'gridCode');
              if (gridCodeHeader) gridCode = gridCodeHeader.value;
              const gridIdHeader = customHeaders.find((h: any) => h.key === 'gridId');
              if (gridIdHeader) gridId = gridIdHeader.value;
            } catch (e) {
              logger.error('Failed to parse customHeaders for PEMS_PFA_READ:', e);
            }
          }

          // Require at least gridCode or gridId to be configured
          if (!gridCode && !gridId) {
            res.status(400).json({
              error: 'MISSING_CONFIGURATION',
              message: 'Grid Code or Grid ID must be configured for PFA Read API. Please set these values in the API configuration.'
            });
            return;
          }

          requestBody = {
            GRID: {
              NUMBER_OF_ROWS_FIRST_RETURNED: 10,
              RESULT_IN_SAXORDER: "TRUE"
            },
            ADDON_SORT: {
              ALIAS_NAME: "pfs_id",
              TYPE: "ASC"
            },
            GRID_TYPE: {
              TYPE: "LIST"
            },
            LOV_PARAMETER: {
              ALIAS_NAME: "pfs_id"
            },
            REQUEST_TYPE: "LIST.DATA_ONLY.STORED"
          };

          if (gridCode) {
            requestBody.GRID.GRID_NAME = gridCode;
          }
          if (gridId) {
            requestBody.GRID.GRID_ID = gridId;
          }

          if (organization) {
            requestBody.ADDON_FILTER = {
              ALIAS_NAME: "pfs_a_org",
              OPERATOR: "BEGINS",
              VALUE: organization
            };
          }

        } else if (config.usage === 'PEMS_PFA_WRITE') {
          // UserDefinedScreenService - write operations are too risky to test
          // We'll just validate authentication by checking if the service is reachable
          // For actual writes, use the real sync/import operations
          res.status(200).json({
            success: true,
            message: 'Write API configuration saved. Test connection is not available for write operations to prevent accidental data modification. Use the actual sync operation to verify connectivity.',
            latencyMs: 0
          });
          return;

        } else if (config.usage === 'PEMS_ASSETS') {
          // Assets API - GET request to fetch asset collection
          method = 'GET';
          requestBody = null; // GET requests have no body
        } else if (config.usage === 'PEMS_CLASSES') {
          // Categories API - GET request to fetch category collection
          method = 'GET';
          requestBody = null; // GET requests have no body
        } else if (config.usage === 'PEMS_ORGANIZATIONS') {
          // Organization API - GET request to fetch organization collection (singular form)
          method = 'GET';
          requestBody = null;
        } else if (config.usage === 'PEMS_USER_SYNC') {
          // UserSetup API - GET request to fetch user collection
          method = 'GET';
          const baseUrl = config.url.replace(/\/$/, ''); // Remove trailing slash
          testUrl = `${baseUrl}/usersetup`; // Use collection endpoint
          headers['organization'] = organization || 'RIO'; // Use org from DB or default
          requestBody = null; // GET requests have no body
        } else if (config.usage === 'PEMS_MANUFACTURERS') {
          // Manufacturers API - GET request to fetch manufacturer collection
          method = 'GET';
          requestBody = null;
        } else {
          // Unknown PEMS API type - use GET with no body
          method = 'GET';
          requestBody = null;
        }

        // Log request details for debugging
        logger.info('Testing PEMS connection:', {
          url: testUrl,
          apiType: config.usage,
          method,
          username,
          tenant: tenant || 'none',
          organization: organization || 'none',
          requestBody: requestBody ? JSON.stringify(requestBody).substring(0, 200) : 'none'
        });

        const response = await fetch(testUrl, {
          method,
          headers,
          ...(requestBody && { body: JSON.stringify(requestBody) }) // Only include body if not null
        });

        const latency = Date.now() - startTime;

        if (response.ok) {
          const responseData = await response.text();
          logger.info('PEMS connection successful:', {
            status: response.status,
            statusText: response.statusText,
            responsePreview: responseData.substring(0, 200)
          });

          testResult = {
            success: true,
            message: 'Connection successful! PEMS API is reachable.',
            latencyMs: latency
          };

          // Update status: PEMS = global only, AI = org if exists, otherwise global
          if (isPEMS) {
            await prisma.api_configurations.update({
              where: { id: config.id },
              data: {
                status: 'connected',
                lastChecked: new Date()
              }
            });
          } else if (orgCred) {
            await prisma.organization_api_credentials.update({
              where: { id: orgCred.id },
              data: {
                status: 'connected',
                lastChecked: new Date(),
                lastError: null
              }
            });
          } else {
            await prisma.api_configurations.update({
              where: { id: config.id },
              data: {
                status: 'connected',
                lastChecked: new Date()
              }
            });
          }
        } else {
          const errorText = await response.text();

          // Log detailed error information
          logger.error('PEMS connection failed:', {
            status: response.status,
            statusText: response.statusText,
            errorBody: errorText,
            url: testUrl,
            username
          });

          // Try to parse error as JSON for better display
          let errorDetails = errorText;
          try {
            const errorJson = JSON.parse(errorText);
            errorDetails = JSON.stringify(errorJson, null, 2);
          } catch (e) {
            // Not JSON, use as-is
          }

          testResult = {
            success: false,
            message: `Connection failed: ${response.status} ${response.statusText}`,
            details: errorDetails,
            errorBody: errorText
          };

          // Update status: PEMS = global only, AI = org if exists, otherwise global
          if (isPEMS) {
            await prisma.api_configurations.update({
              where: { id: config.id },
              data: {
                status: 'error',
                lastChecked: new Date()
              }
            });
          } else if (orgCred) {
            await prisma.organization_api_credentials.update({
              where: { id: orgCred.id },
              data: {
                status: 'error',
                lastChecked: new Date(),
                lastError: `HTTP ${response.status}: ${response.statusText}`
              }
            });
          } else {
            await prisma.api_configurations.update({
              where: { id: config.id },
              data: {
                status: 'error',
                lastChecked: new Date()
              }
            });
          }
        }
      } else if (config.usage.startsWith('AI')) {
        // Test AI provider connection (REAL TEST, not mocked!)

        if (config.usage === 'AI_GEMINI') {
          // Test Gemini API
          const response = await fetch(
            `${config.url}/gemini-1.5-flash-002:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [{ text: 'Say "test successful" if you can read this.' }]
                }]
              })
            }
          );

          const latency = Date.now() - startTime;

          if (response.ok) {
            const data: any = await response.json();
            testResult = {
              success: true,
              message: 'Connection successful! Gemini API key is valid.',
              latencyMs: latency,
              response: data.candidates?.[0]?.content?.parts?.[0]?.text
            };

            if (orgCred) {
              await prisma.organization_api_credentials.update({
                where: { id: orgCred.id },
                data: {
                  status: 'connected',
                  lastChecked: new Date(),
                  lastError: null
                }
              });
            } else {
              await prisma.api_configurations.update({
                where: { id: config.id },
                data: {
                  status: 'connected',
                  lastChecked: new Date()
                }
              });
            }
          } else {
            const errorData: any = await response.json();
            testResult = {
              success: false,
              message: `Invalid API key or request error: ${response.statusText}`,
              details: errorData
            };

            if (orgCred) {
              await prisma.organization_api_credentials.update({
                where: { id: orgCred.id },
                data: {
                  status: 'error',
                  lastChecked: new Date(),
                  lastError: errorData.error?.message || response.statusText
                }
              });
            } else {
              await prisma.api_configurations.update({
                where: { id: config.id },
                data: {
                  status: 'error',
                  lastChecked: new Date()
                }
              });
            }
          }
        } else if (config.usage === 'AI_OPENAI') {
          // Test OpenAI API
          const response = await fetch(`${config.url}/models`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });

          const latency = Date.now() - startTime;

          if (response.ok) {
            testResult = {
              success: true,
              message: 'Connection successful! OpenAI API key is valid.',
              latencyMs: latency
            };

            if (orgCred) {
              await prisma.organization_api_credentials.update({
                where: { id: orgCred.id },
                data: {
                  status: 'connected',
                  lastChecked: new Date(),
                  lastError: null
                }
              });
            } else {
              await prisma.api_configurations.update({
                where: { id: config.id },
                data: {
                  status: 'connected',
                  lastChecked: new Date()
                }
              });
            }
          } else {
            const errorData: any = await response.json();
            testResult = {
              success: false,
              message: `Invalid API key: ${response.statusText}`,
              details: errorData
            };

            if (orgCred) {
              await prisma.organization_api_credentials.update({
                where: { id: orgCred.id },
                data: {
                  status: 'error',
                  lastChecked: new Date(),
                  lastError: errorData.error?.message || response.statusText
                }
              });
            } else {
              await prisma.api_configurations.update({
                where: { id: config.id },
                data: {
                  status: 'error',
                  lastChecked: new Date()
                }
              });
            }
          }
        } else {
          // For other AI providers, return not implemented for now
          testResult = {
            success: false,
            message: `Testing for ${config.usage} not yet implemented`
          };
        }
      }

      res.json(testResult);
    } catch (error: unknown) {
      handleControllerError(error, res, 'ApiConfigController.testConnection');
    }
  } catch (error) {
    logger.error('Test API config failed:', error);
    res.status(500).json({
      error: 'TEST_ERROR',
      message: 'Failed to test API configuration'
    });
  }
};

/**
 * POST /api/configs (Admin only)
 * Create a new global API configuration
 */
export const createGlobalConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      usage,
      url,
      authType,
      operationType,
      username,
      password,
      apiKey,
      tenant,
      organization
    } = req.body;

    // Validation
    if (!name || !usage || !url || !authType) {
      res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Missing required fields'
      });
      return;
    }

    // Encrypt credentials
    let authKeyEncrypted = null;
    let authValueEncrypted = null;

    if (authType === 'basic') {
      if (username) authKeyEncrypted = encrypt(username);
      if (password) authValueEncrypted = encrypt(password);
    } else if (authType === 'apiKey') {
      if (apiKey) authValueEncrypted = encrypt(apiKey);
    }

    // Store tenant, organization, gridCode, and gridId in customHeaders
    let customHeaders = null;
    const headers: any[] = [];
    if (tenant) headers.push({ key: 'tenant', value: tenant });
    if (organization) headers.push({ key: 'organization', value: organization });
    if (req.body.gridCode) headers.push({ key: 'gridCode', value: req.body.gridCode });
    if (req.body.gridId) headers.push({ key: 'gridId', value: req.body.gridId });
    if (headers.length > 0) {
      customHeaders = JSON.stringify(headers);
    }

    const config = await prisma.api_configurations.create({
      data: {
        organizationId: null, // NULL = global
        name,
        usage,
        url,
        authType,
        authKeyEncrypted,
        authValueEncrypted,
        customHeaders,
        operationType: operationType || 'read',
        status: 'untested',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any
    });

    res.json({
      success: true,
      config: {
        id: config.id,
        type: config.usage,
        name: config.name,
        url: config.url,
        authType: config.authType,
        status: config.status,
        operationType: config.operationType,
        isGlobal: true
      }
    });
  } catch (error) {
    logger.error('Failed to create global config:', error);
    res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to create API configuration'
    });
  }
};

/**
 * PUT /api/configs/:id (Admin only)
 * Update a global API configuration
 */
export const updateGlobalConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      url,
      authType,
      operationType,
      username,
      password,
      apiKey,
      tenant,
      organization
    } = req.body;

    // Check if config exists and is global
    const existing = await prisma.api_configurations.findUnique({
      where: { id }
    });

    if (!existing) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'API configuration not found'
      });
      return;
    }

    if (existing.organizationId !== null) {
      res.status(400).json({
        error: 'INVALID_CONFIG',
        message: 'This is not a global API configuration'
      });
      return;
    }

    // Prepare update data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (url) updateData.url = url;
    if (authType) updateData.authType = authType;
    if (operationType) updateData.operationType = operationType;

    // Encrypt credentials if provided
    if (username || password || apiKey) {
      if ((authType || existing.authType) === 'basic') {
        if (username) updateData.authKeyEncrypted = encrypt(username);
        if (password) updateData.authValueEncrypted = encrypt(password);
      } else if ((authType || existing.authType) === 'apiKey') {
        if (apiKey) updateData.authValueEncrypted = encrypt(apiKey);
      }
    }

    // Update tenant, organization, gridCode, and gridId in customHeaders
    // Preserve existing customHeaders and only update specified fields
    logger.info('Update request body:', {
      tenant,
      organization,
      gridCode: req.body.gridCode,
      gridId: req.body.gridId
    });

    if (tenant !== undefined || organization !== undefined || req.body.gridCode !== undefined || req.body.gridId !== undefined) {
      // Start with existing headers
      let existingHeaders: any[] = [];
      if (existing.customHeaders) {
        try {
          existingHeaders = JSON.parse(existing.customHeaders);
        } catch (e) {
          logger.warn('Failed to parse existing customHeaders:', e);
        }
      }

      // Create a map for easy update
      const headersMap = new Map(existingHeaders.map((h: any) => [h.key, h.value]));

      // Update/add new values (allow empty strings to clear values)
      if (tenant !== undefined) {
        if (tenant) {
          headersMap.set('tenant', tenant);
        } else {
          headersMap.delete('tenant');
        }
      }
      if (organization !== undefined) {
        if (organization) {
          headersMap.set('organization', organization);
        } else {
          headersMap.delete('organization');
        }
      }
      if (req.body.gridCode !== undefined) {
        if (req.body.gridCode) {
          headersMap.set('gridCode', req.body.gridCode);
        } else {
          headersMap.delete('gridCode');
        }
      }
      if (req.body.gridId !== undefined) {
        if (req.body.gridId) {
          headersMap.set('gridId', req.body.gridId);
        } else {
          headersMap.delete('gridId');
        }
      }

      // Convert back to array
      const headers = Array.from(headersMap.entries()).map(([key, value]) => ({ key, value }));
      updateData.customHeaders = headers.length > 0 ? JSON.stringify(headers) : null;
      logger.info('Setting customHeaders:', { customHeaders: updateData.customHeaders, headersMap: Array.from(headersMap.entries()) });
    }

    // Reset status to untested if credentials changed
    if (updateData.authKeyEncrypted || updateData.authValueEncrypted || updateData.customHeaders) {
      updateData.status = 'untested';
    }

    const updated = await prisma.api_configurations.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      config: {
        id: updated.id,
        type: updated.usage,
        name: updated.name,
        url: updated.url,
        authType: updated.authType,
        status: updated.status,
        operationType: updated.operationType,
        isGlobal: true
      }
    });
  } catch (error) {
    logger.error('Failed to update global config:', error);
    res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to update API configuration'
    });
  }
};

/**
 * DELETE /api/configs/:id (Admin only)
 * Delete a global API configuration
 */
export const deleteGlobalConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify it's a global config
    const config = await prisma.api_configurations.findUnique({
      where: { id }
    });

    if (!config) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'API configuration not found'
      });
      return;
    }

    if (config.organizationId !== null) {
      res.status(400).json({
        error: 'INVALID_CONFIG',
        message: 'This is not a global API configuration'
      });
      return;
    }

    // This will cascade delete all org credentials due to onDelete: Cascade
    await prisma.api_configurations.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Global API configuration deleted' });
  } catch (error) {
    logger.error('Failed to delete global config:', error);
    res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to delete API configuration'
    });
  }
};
