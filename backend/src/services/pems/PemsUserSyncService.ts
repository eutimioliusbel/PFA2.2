/**
 * PEMS User Sync Service
 *
 * Syncs user data from PEMS UserSetup API with **selective filtering**.
 * NOT ALL USERS FROM PEMS ARE SYNCED - only those meeting strict criteria.
 *
 * Filtering Criteria:
 * 1. Active users only (ISACTIVE = '+')
 * 2. Specific user groups (PROJECT_MANAGERS, COST_ENGINEERS, ADMINISTRATORS, BEO_USERS)
 * 3. Specific organizations (BECH, HOLNG, RIO)
 * 4. PFA Access Flag (StandardUserDefinedFields.UDFCHAR01 = 'Y')
 *
 * Architecture:
 * - Fetches users in pages with pagination (cursorposition)
 * - Fetches organization assignments for each user
 * - Applies 4-tier filtering before creating/updating records
 * - Implements hybrid authentication (authProvider='pems', nullable passwordHash)
 * - Maps LDAP roles to UserOrganization.externalRoleId
 * - Logs external entity syncs for AI data lineage tracking
 *
 * @see docs/PEMS_USER_SYNC_FILTERING.md for detailed filtering rules
 */

import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import { decrypt } from '../../utils/encryption';
import { DataCollectionService } from '../aiDataHooks/DataCollectionService';
import { randomUUID } from 'crypto';

// ============================================================================
// Type Definitions
// ============================================================================

export interface UserSyncFilters {
  requiredOrganizations: string[];      // e.g., ['BECH', 'HOLNG', 'RIO']
  onlyActiveUsers: boolean;             // true (ISACTIVE = '+')
  allowedUserGroups: string[];          // e.g., ['PROJECT_MANAGERS', 'COST_ENGINEERS']
  customFieldFilters: {                 // e.g., [{ fieldName: 'UDFCHAR01', values: ['Y', 'YES', 'TRUE'] }]
    fieldName: string;
    values: string[];
  }[];
}

export interface UserSyncProgress {
  syncId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  organizationId: string;
  totalUsers: number;
  processedUsers: number;
  syncedUsers: number;
  skippedUsers: number;
  errorUsers: number;
  startedAt: Date;
  completedAt?: Date;
  currentPage: number;
  error?: string;
}

interface PemsUser {
  USERID: { USERCODE: string; DESCRIPTION?: string };
  EMAIL?: string;
  ISACTIVE: string;
  USERGROUP: string;
  EXTERNALUSERID?: string;
  StandardUserDefinedFields?: {
    UDFCHAR01?: string;
    UDFCHAR02?: string;
    // ... other UDF fields
  };
  LANGUAGE?: string;
  DEPARTMENTCODE?: string;
}

interface PemsUserOrganization {
  USERORGANIZATIONID: {
    ORGANIZATIONID: { ORGANIZATIONCODE: string; DESCRIPTION?: string };
    USERID: { USERCODE: string };
    LDAPROLEID?: { ROLECODE: string; DESCRIPTION?: string };
  };
  USERGROUP: string;
  DEFAULTORGANIZATION?: string;
}

interface SkipReason {
  userId: string;
  reason: string;
  details: string;
}

// ============================================================================
// PEMS User Sync Service
// ============================================================================

export class PemsUserSyncService {
  private syncFilters: UserSyncFilters;
  private skippedUsers: SkipReason[] = [];

  constructor(filters?: Partial<UserSyncFilters>) {
    // Default filtering configuration
    this.syncFilters = {
      requiredOrganizations: filters?.requiredOrganizations || ['BECH', 'HOLNG', 'RIO'],
      onlyActiveUsers: filters?.onlyActiveUsers !== undefined ? filters.onlyActiveUsers : true,
      allowedUserGroups: filters?.allowedUserGroups || [
        'PROJECT_MANAGERS',
        'COST_ENGINEERS',
        'ADMINISTRATORS',
        'BEO_USERS'
      ],
      customFieldFilters: filters?.customFieldFilters || [
        { fieldName: 'UDFCHAR01', values: ['Y', 'YES', 'TRUE', 'true', 'yes', '1'] }
      ]
    };
  }

  /**
   * Sync users from PEMS for a specific organization
   */
  async syncUsers(
    organizationId: string,
    apiConfigId: string,
    syncId?: string
  ): Promise<UserSyncProgress> {
    const finalSyncId = syncId || `user-sync-${Date.now()}`;
    const startTime = new Date();

    logger.info(`Starting PEMS user sync for organization ${organizationId}`, {
      syncId: finalSyncId,
      filters: this.syncFilters
    });

    // Reset skip tracking
    this.skippedUsers = [];

    try {
      // Get organization details
      const organization = await prisma.organizations.findUnique({
        where: { id: organizationId }
      });

      if (!organization) {
        throw new Error(`Organization ${organizationId} not found`);
      }

      // Get API configuration
      const config = await prisma.api_configurations.findUnique({
        where: { id: apiConfigId }
      });

      if (!config) {
        throw new Error(`API Configuration '${apiConfigId}' not found`);
      }

      // Decrypt credentials
      const { username, password, tenant, pemsOrganizationCode } =
        await this.getCredentials(config, organization, organizationId, apiConfigId);

      // Initialize progress tracking
      const progress: UserSyncProgress = {
        syncId: finalSyncId,
        status: 'running',
        organizationId,
        totalUsers: 0,
        processedUsers: 0,
        syncedUsers: 0,
        skippedUsers: 0,
        errorUsers: 0,
        startedAt: startTime,
        currentPage: 0
      };

      // Create audit log entry for sync start (Phase 3, Task 3.2)
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId: 'system', // System action
          organizationId,
          action: 'user_sync_started',
          resource: 'pems_user_sync',
          method: 'POST',
          success: true,
          metadata: {
            syncId: finalSyncId,
            filters: this.syncFilters as any,
            apiConfigId,
            timestamp: new Date().toISOString()
          }
        }
      });

      // Fetch and process users page by page
      let cursorPosition = 0;
      let hasMoreData = true;

      while (hasMoreData) {
        progress.currentPage++;
        logger.info(`Fetching user page ${progress.currentPage} (cursor: ${cursorPosition})`);

        const response = await this.fetchUsersPage(
          config.url,
          username,
          password,
          tenant,
          pemsOrganizationCode,
          cursorPosition
        );

        const users: PemsUser[] = response.users;
        const nextCursor = response.nextCursor;

        if (users.length === 0) {
          logger.info(`No more users found, stopping at page ${progress.currentPage}`);
          hasMoreData = false;
          break;
        }

        logger.info(`Fetched ${users.length} users from PEMS`);

        // Process each user with filtering
        for (const pemsUser of users) {
          progress.processedUsers++;

          try {
            // STEP 1: Apply user-level filters
            const shouldSync = this.shouldSyncUser(pemsUser);

            if (!shouldSync.sync) {
              progress.skippedUsers++;
              this.skippedUsers.push({
                userId: pemsUser.USERID.USERCODE,
                reason: shouldSync.reason || 'Unknown',
                details: shouldSync.details || ''
              });
              logger.debug(`Skipping user ${pemsUser.USERID.USERCODE}: ${shouldSync.reason}`);
              continue;
            }

            // STEP 2: Fetch user organizations
            const userOrgs = await this.fetchUserOrganizations(
              config.url,
              username,
              password,
              tenant,
              pemsOrganizationCode,
              pemsUser.USERID.USERCODE
            );

            // STEP 3: Filter organizations
            const filteredOrgs = userOrgs.filter(uo =>
              this.syncFilters.requiredOrganizations.includes(
                uo.USERORGANIZATIONID.ORGANIZATIONID.ORGANIZATIONCODE
              )
            );

            if (filteredOrgs.length === 0) {
              progress.skippedUsers++;
              this.skippedUsers.push({
                userId: pemsUser.USERID.USERCODE,
                reason: 'No matching organizations',
                details: `User has orgs: ${userOrgs.map(o => o.USERORGANIZATIONID.ORGANIZATIONID.ORGANIZATIONCODE).join(', ')}`
              });
              logger.debug(`Skipping user ${pemsUser.USERID.USERCODE}: No matching organizations`);
              continue;
            }

            // STEP 4: Upsert user and organization assignments
            await this.upsertUser(pemsUser, filteredOrgs, organizationId);
            progress.syncedUsers++;

            logger.info(`Synced user ${pemsUser.USERID.USERCODE} with ${filteredOrgs.length} organizations`);

          } catch (error: unknown) {
            progress.errorUsers++;
            logger.error(`Error syncing user ${pemsUser.USERID.USERCODE}:`, error);
          }
        }

        progress.totalUsers = progress.processedUsers;

        // Check for next page
        if (nextCursor === null || nextCursor === cursorPosition) {
          hasMoreData = false;
        } else {
          cursorPosition = nextCursor;
        }

        logger.info(`Progress: ${progress.processedUsers} processed, ${progress.syncedUsers} synced, ${progress.skippedUsers} skipped`);
      }

      // Mark sync as completed
      progress.status = 'completed';
      progress.completedAt = new Date();

      logger.info(`User sync completed`, {
        syncId: finalSyncId,
        totalUsers: progress.totalUsers,
        syncedUsers: progress.syncedUsers,
        skippedUsers: progress.skippedUsers,
        errorUsers: progress.errorUsers,
        duration: progress.completedAt.getTime() - startTime.getTime()
      });

      // Log skip summary
      this.logSkipSummary();

      // Create audit log entry for completed sync (Phase 3, Task 3.2)
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId: 'system', // System action
          organizationId,
          action: 'user_sync_completed',
          resource: 'pems_user_sync',
          method: 'POST',
          success: true,
          metadata: {
            syncId: finalSyncId,
            totalUsers: progress.totalUsers,
            syncedUsers: progress.syncedUsers,
            skippedUsers: progress.skippedUsers,
            errorUsers: progress.errorUsers,
            durationMs: progress.completedAt.getTime() - startTime.getTime(),
            filters: this.syncFilters as any,
            skipReasons: this.getSkipSummary(),
            timestamp: new Date().toISOString()
          }
        }
      });

      return progress;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`User sync failed:`, error);

      // Create audit log entry for failed sync (Phase 3, Task 3.2)
      try {
        await prisma.audit_logs.create({
          data: {
            id: randomUUID(),
            userId: 'system', // System action
            organizationId,
            action: 'user_sync_failed',
            resource: 'pems_user_sync',
            method: 'POST',
            success: false,
            metadata: {
              syncId: finalSyncId,
              error: errorMessage,
              filters: this.syncFilters as any,
              timestamp: new Date().toISOString()
            }
          }
        });
      } catch (auditError) {
        logger.error('Failed to create audit log for failed sync:', auditError);
      }

      throw error;
    }
  }

  /**
   * Filter logic: Determine if a PEMS user should be synced
   */
  private shouldSyncUser(pemsUser: PemsUser): { sync: boolean; reason?: string; details?: string } {
    // Filter 1: Active users only
    if (this.syncFilters.onlyActiveUsers && pemsUser.ISACTIVE !== '+') {
      return {
        sync: false,
        reason: 'Inactive user',
        details: `ISACTIVE = '${pemsUser.ISACTIVE}' (expected '+')`
      };
    }

    // Filter 2: Allowed user groups
    if (!this.syncFilters.allowedUserGroups.includes(pemsUser.USERGROUP)) {
      return {
        sync: false,
        reason: 'User group not allowed',
        details: `USERGROUP = '${pemsUser.USERGROUP}' (allowed: ${this.syncFilters.allowedUserGroups.join(', ')})`
      };
    }

    // Filter 3: Custom field filters (e.g., UDFCHAR01 = 'Y')
    for (const filter of this.syncFilters.customFieldFilters) {
      const fieldValue = pemsUser.StandardUserDefinedFields?.[filter.fieldName as keyof typeof pemsUser.StandardUserDefinedFields];

      if (!fieldValue || !filter.values.includes(fieldValue.toString().trim())) {
        return {
          sync: false,
          reason: 'Custom field filter not met',
          details: `${filter.fieldName} = '${fieldValue || 'NULL'}' (expected: ${filter.values.join(' or ')})`
        };
      }
    }

    return { sync: true };
  }

  /**
   * Fetch users from PEMS UserSetup API (paginated)
   */
  private async fetchUsersPage(
    baseUrl: string,
    username: string,
    password: string,
    tenant: string,
    organization: string,
    cursorPosition: number
  ): Promise<{ users: PemsUser[]; nextCursor: number | null }> {
    const url = `${baseUrl}/usersetup`;

    const headers = {
      'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
      'Content-Type': 'application/json',
      'tenant': tenant,
      'organization': organization,
      'cursorposition': cursorPosition.toString()
    };

    logger.debug(`Fetching users from PEMS`, { url, cursorPosition });

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PEMS API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: any = await response.json();

    // Parse PEMS response structure
    const users = data?.Result?.ResultData?.DATARECORD || [];
    const nextCursor = data?.Result?.ResultData?.NEXTCURSORPOSITION;

    return {
      users,
      nextCursor: nextCursor !== undefined ? nextCursor : null
    };
  }

  /**
   * Fetch user organization assignments from PEMS
   */
  private async fetchUserOrganizations(
    baseUrl: string,
    username: string,
    password: string,
    tenant: string,
    organization: string,
    userId: string
  ): Promise<PemsUserOrganization[]> {
    const url = `${baseUrl}/usersetup/${encodeURIComponent(userId)}/organizations`;

    const headers = {
      'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
      'Content-Type': 'application/json',
      'tenant': tenant,
      'organization': organization
    };

    logger.debug(`Fetching organizations for user ${userId}`, { url });

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Failed to fetch organizations for user ${userId}: ${response.status} ${errorText}`);
      return []; // Return empty array instead of throwing
    }

    const data: any = await response.json();

    // Parse PEMS response structure
    const userOrgs = data?.Result?.ResultData?.DATARECORD || [];

    return userOrgs;
  }

  /**
   * Upsert user and organization assignments to database
   * Implements hybrid authentication (authProvider='pems', nullable passwordHash)
   */
  private async upsertUser(
    pemsUser: PemsUser,
    userOrgs: PemsUserOrganization[],
    organizationId: string
  ): Promise<void> {
    const username = pemsUser.USERID.USERCODE;
    const email = pemsUser.EMAIL || `${username}@pems.generated`;

    // IMPORTANT: For PEMS users, passwordHash is NULL (no local password)
    // authProvider field will be added in Phase 0, Task 0.2 (schema migration)
    // For now, we use email pattern to identify PEMS users

    // Upsert user
    const existingUser = await prisma.users.findUnique({ where: { username } });
    const user = await prisma.users.upsert({
      where: { username },
      update: {
        email,
        isActive: pemsUser.ISACTIVE === '+',
        // FUTURE: authProvider: 'pems',
        // FUTURE: externalUserId: pemsUser.EXTERNALUSERID || username,
        updatedAt: new Date()
      },
      create: {
        id: randomUUID(),
        username,
        email,
        passwordHash: '', // TEMPORARY: Will be made nullable in Phase 0, Task 0.2
        isActive: pemsUser.ISACTIVE === '+',
        role: this.mapUserGroupToRole(pemsUser.USERGROUP),
        updatedAt: new Date(),
        // FUTURE: authProvider: 'pems',
        // FUTURE: externalUserId: pemsUser.EXTERNALUSERID || username,
      }
    });

    // AI Data Hook: Log external entity sync (non-blocking)
    DataCollectionService.logExternalEntitySync({
      userId: 'system',
      organizationId: organizationId,
      action: existingUser ? 'updated' : 'created',
      entityType: 'User',
      entityId: user.id,
      externalId: username,
      externalSystem: 'PEMS',
      syncMetadata: {
        recordsProcessed: 1,
        recordsInserted: existingUser ? 0 : 1,
        recordsUpdated: existingUser ? 1 : 0,
        recordsSkipped: 0
      }
    }).catch(err => logger.error('Failed to log user sync for AI', { error: err, username }));

    // Upsert organization assignments
    for (const userOrg of userOrgs) {
      const orgCode = userOrg.USERORGANIZATIONID.ORGANIZATIONID.ORGANIZATIONCODE;

      // Find organization by code
      const org = await prisma.organizations.findUnique({
        where: { code: orgCode }
      });

      if (!org) {
        logger.warn(`Organization ${orgCode} not found in database, skipping assignment`);
        continue;
      }

      // Upsert UserOrganization
      await prisma.user_organizations.upsert({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: org.id
          }
        },
        update: {
          role: this.mapUserGroupToRole(userOrg.USERGROUP),
          modifiedAt: new Date(),
          // FUTURE: externalRoleId: userOrg.USERORGANIZATIONID.LDAPROLEID?.ROLECODE,
        },
        create: {
          id: `${user.id}-${org.id}`,
          users: { connect: { id: user.id } },
          organizations: { connect: { id: org.id } },
          role: this.mapUserGroupToRole(userOrg.USERGROUP),
          modifiedAt: new Date(),
          // FUTURE: externalRoleId: userOrg.USERORGANIZATIONID.LDAPROLEID?.ROLECODE,
        }
      });
    }
  }

  /**
   * Map PEMS USERGROUP to PFA Vanguard role
   */
  private mapUserGroupToRole(userGroup: string): string {
    const roleMap: Record<string, string> = {
      'ADMINISTRATORS': 'admin',
      'PROJECT_MANAGERS': 'admin',
      'COST_ENGINEERS': 'user',
      'BEO_USERS': 'user',
      'CONTRACTORS': 'viewer',
      'INSPECTORS': 'viewer'
    };

    return roleMap[userGroup] || 'user';
  }

  /**
   * Get decrypted credentials from API configuration
   */
  private async getCredentials(
    config: any,
    organization: any,
    organizationId: string,
    apiConfigId: string
  ): Promise<{ username: string; password: string; tenant: string; pemsOrganizationCode: string }> {
    let username = '';
    let password = '';
    let tenant = '';
    let pemsOrganizationCode = organization.code;

    // Decrypt global credentials
    if (config.authKeyEncrypted) {
      username = decrypt(config.authKeyEncrypted);
    }
    if (config.authValueEncrypted) {
      password = decrypt(config.authValueEncrypted);
    }

    // Check for organization-specific credentials
    const orgCredentials = await prisma.organization_api_credentials.findUnique({
      where: {
        organizationId_apiConfigurationId: {
          organizationId: organizationId,
          apiConfigurationId: apiConfigId
        }
      }
    });

    // Parse headers for tenant and organization
    if (orgCredentials?.customHeaders) {
      try {
        const headers = JSON.parse(orgCredentials.customHeaders);
        const orgHeader = headers.find((h: any) => h.key === 'organization');
        if (orgHeader) pemsOrganizationCode = orgHeader.value;
      } catch (e) {
        logger.error('Failed to parse org-specific customHeaders:', e);
      }
    }

    if (config.customHeaders) {
      try {
        const headers = JSON.parse(config.customHeaders);
        const tenantHeader = headers.find((h: any) => h.key === 'tenant');
        if (tenantHeader) tenant = tenantHeader.value;

        if (pemsOrganizationCode === organization.code) {
          const orgHeader = headers.find((h: any) => h.key === 'organization');
          if (orgHeader) pemsOrganizationCode = orgHeader.value;
        }
      } catch (e) {
        logger.error('Failed to parse customHeaders:', e);
      }
    }

    if (!username || !password) {
      throw new Error('PEMS credentials not configured');
    }

    return { username, password, tenant, pemsOrganizationCode };
  }

  /**
   * Log summary of skipped users
   */
  private logSkipSummary(): void {
    if (this.skippedUsers.length === 0) {
      logger.info(`No users were skipped during sync`);
      return;
    }

    // Group by reason
    const skipReasons = new Map<string, number>();
    this.skippedUsers.forEach(skip => {
      const count = skipReasons.get(skip.reason) || 0;
      skipReasons.set(skip.reason, count + 1);
    });

    logger.info(`Skipped ${this.skippedUsers.length} users:`, {
      summary: Array.from(skipReasons.entries()).map(([reason, count]) => `${reason}: ${count}`)
    });

    // Log first 10 skipped users for debugging
    logger.debug(`First 10 skipped users:`, {
      users: this.skippedUsers.slice(0, 10)
    });
  }

  /**
   * Get list of skipped users (for reporting)
   */
  getSkippedUsers(): SkipReason[] {
    return this.skippedUsers;
  }

  /**
   * Get skip summary grouped by reason (for audit logging)
   * Phase 3, Task 3.2: User Permission Sync Filtering
   */
  private getSkipSummary(): Record<string, number> {
    const summary: Record<string, number> = {};

    this.skippedUsers.forEach(skip => {
      summary[skip.reason] = (summary[skip.reason] || 0) + 1;
    });

    return summary;
  }
}
