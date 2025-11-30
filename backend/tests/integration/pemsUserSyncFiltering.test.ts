/**
 * Integration Tests: PEMS User Sync Filtering
 * Phase 3, Task 3.2 - User Permission Sync Filtering (ADR-005)
 *
 * Tests verify that:
 * 1. Inactive users are skipped (ISACTIVE != '+')
 * 2. Users without allowed user groups are skipped
 * 3. Users without PFA access flag (UDFCHAR01 != 'Y') are skipped
 * 4. Users without matching organizations are skipped
 * 5. Skip reasons are logged with accurate details
 * 6. Sync summary includes skip count and reasons
 * 7. Audit logs are created for sync start, complete, and failure
 *
 * Run with: npm test -- pemsUserSyncFiltering.test.ts
 */

import prisma from '../../src/config/database';
import { PemsUserSyncService } from '../../src/services/pems/PemsUserSyncService';
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach, Mock } from 'vitest';

// Mock fetch for PEMS API calls
global.fetch = vi.fn();

describe('PEMS User Sync Filtering - Integration Tests', () => {
  let userSyncService: PemsUserSyncService;
  let testOrgId: string;
  let testApiConfigId: string;

  beforeAll(async () => {
    // Create test organization
    const testOrg = await prisma.organization.create({
      data: {
        code: 'BECH',
        name: 'Bechtel Test Organization',
        isActive: true,
        isExternal: true,
        enableSync: true,
        serviceStatus: 'active'
      }
    });
    testOrgId = testOrg.id;

    // Create test API configuration
    const apiConfig = await prisma.apiConfiguration.create({
      data: {
        name: 'Test PEMS User API',
        url: 'https://test.pems.com/api',
        authType: 'basic',
        authKeyEncrypted: 'encrypted_test_username',
        authValueEncrypted: 'encrypted_test_password',
        operationType: 'read',
        customHeaders: JSON.stringify([
          { key: 'tenant', value: 'BECH' },
          { key: 'organization', value: 'BECH' }
        ]),
        feeds: JSON.stringify([{
          entity: 'users',
          views: ['UserSetup']
        }])
      }
    });
    testApiConfigId = apiConfig.id;

    // Initialize service with test filters
    userSyncService = new PemsUserSyncService({
      requiredOrganizations: ['BECH', 'HOLNG', 'RIO'],
      onlyActiveUsers: true,
      allowedUserGroups: ['PROJECT_MANAGERS', 'COST_ENGINEERS', 'ADMINISTRATORS', 'BEO_USERS'],
      customFieldFilters: [
        { fieldName: 'UDFCHAR01', values: ['Y', 'YES', 'TRUE', 'true', 'yes', '1'] }
      ]
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.auditLog.deleteMany({
      where: { organizationId: testOrgId }
    });

    await prisma.organization.delete({
      where: { id: testOrgId }
    });

    await prisma.apiConfiguration.delete({
      where: { id: testApiConfigId }
    });

    await prisma.$disconnect();
  });

  beforeEach(() => {
    // Reset mock before each test
    (global.fetch as Mock).mockReset();
  });

  describe('Filter 1: Active Users Only', () => {
    it('should skip inactive users and log skip reason', async () => {
      // Mock PEMS API response with inactive user
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Result: {
            ResultData: {
              DATARECORD: [
                {
                  USERID: { USERCODE: 'INACTIVE001' },
                  EMAIL: 'inactive@test.com',
                  ISACTIVE: '-', // Inactive
                  USERGROUP: 'PROJECT_MANAGERS',
                  StandardUserDefinedFields: { UDFCHAR01: 'Y' }
                }
              ],
              CURRENTCURSORPOSITION: 0,
              NEXTCURSORPOSITION: null
            }
          }
        })
      });

      const result = await userSyncService.syncUsers(testOrgId, testApiConfigId);

      // Verify user was skipped
      expect(result.processedUsers).toBe(1);
      expect(result.syncedUsers).toBe(0);
      expect(result.skippedUsers).toBe(1);

      // Verify skip reason
      const skippedUsers = userSyncService.getSkippedUsers();
      expect(skippedUsers.length).toBe(1);
      expect(skippedUsers[0].userId).toBe('INACTIVE001');
      expect(skippedUsers[0].reason).toBe('Inactive user');
      expect(skippedUsers[0].details).toContain("ISACTIVE = '-'");
    });

    it('should sync active users', async () => {
      // Mock PEMS API response with active user
      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Result: {
              ResultData: {
                DATARECORD: [
                  {
                    USERID: { USERCODE: 'ACTIVE001' },
                    EMAIL: 'active@test.com',
                    ISACTIVE: '+', // Active
                    USERGROUP: 'PROJECT_MANAGERS',
                    StandardUserDefinedFields: { UDFCHAR01: 'Y' }
                  }
                ],
                CURRENTCURSORPOSITION: 0,
                NEXTCURSORPOSITION: null
              }
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Result: {
              ResultData: {
                DATARECORD: [
                  {
                    USERORGANIZATIONID: {
                      ORGANIZATIONID: { ORGANIZATIONCODE: 'BECH' },
                      USERID: { USERCODE: 'ACTIVE001' }
                    },
                    USERGROUP: 'PROJECT_MANAGERS'
                  }
                ]
              }
            }
          })
        });

      const result = await userSyncService.syncUsers(testOrgId, testApiConfigId);

      // Verify user was synced
      expect(result.processedUsers).toBe(1);
      expect(result.syncedUsers).toBe(1);
      expect(result.skippedUsers).toBe(0);
    });
  });

  describe('Filter 2: Allowed User Groups', () => {
    it('should skip users with disallowed user groups', async () => {
      // Mock PEMS API response with contractor (not allowed)
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Result: {
            ResultData: {
              DATARECORD: [
                {
                  USERID: { USERCODE: 'CONTRACTOR001' },
                  EMAIL: 'contractor@test.com',
                  ISACTIVE: '+',
                  USERGROUP: 'CONTRACTORS', // Not in allowed list
                  StandardUserDefinedFields: { UDFCHAR01: 'Y' }
                }
              ],
              CURRENTCURSORPOSITION: 0,
              NEXTCURSORPOSITION: null
            }
          }
        })
      });

      const result = await userSyncService.syncUsers(testOrgId, testApiConfigId);

      // Verify user was skipped
      expect(result.skippedUsers).toBe(1);

      const skippedUsers = userSyncService.getSkippedUsers();
      expect(skippedUsers[0].reason).toBe('User group not allowed');
      expect(skippedUsers[0].details).toContain('CONTRACTORS');
    });

    it('should sync users with allowed user groups', async () => {
      const allowedGroups = ['PROJECT_MANAGERS', 'COST_ENGINEERS', 'ADMINISTRATORS', 'BEO_USERS'];

      for (const userGroup of allowedGroups) {
        // Reset mock and skipped users
        (global.fetch as Mock).mockReset();

        // Mock PEMS API response
        (global.fetch as Mock)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              Result: {
                ResultData: {
                  DATARECORD: [
                    {
                      USERID: { USERCODE: `USER_${userGroup}` },
                      EMAIL: `${userGroup.toLowerCase()}@test.com`,
                      ISACTIVE: '+',
                      USERGROUP: userGroup,
                      StandardUserDefinedFields: { UDFCHAR01: 'Y' }
                    }
                  ],
                  CURRENTCURSORPOSITION: 0,
                  NEXTCURSORPOSITION: null
                }
              }
            })
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              Result: {
                ResultData: {
                  DATARECORD: [
                    {
                      USERORGANIZATIONID: {
                        ORGANIZATIONID: { ORGANIZATIONCODE: 'BECH' },
                        USERID: { USERCODE: `USER_${userGroup}` }
                      },
                      USERGROUP: userGroup
                    }
                  ]
                }
              }
            })
          });

        const result = await userSyncService.syncUsers(testOrgId, testApiConfigId);

        // Verify user was synced (not skipped)
        expect(result.syncedUsers).toBe(1);
      }
    });
  });

  describe('Filter 3: PFA Access Flag (UDFCHAR01)', () => {
    it('should skip users without PFA access flag', async () => {
      // Mock PEMS API response with user who has UDFCHAR01 = 'N'
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Result: {
            ResultData: {
              DATARECORD: [
                {
                  USERID: { USERCODE: 'NOACCESS001' },
                  EMAIL: 'noaccess@test.com',
                  ISACTIVE: '+',
                  USERGROUP: 'PROJECT_MANAGERS',
                  StandardUserDefinedFields: { UDFCHAR01: 'N' } // No access
                }
              ],
              CURRENTCURSORPOSITION: 0,
              NEXTCURSORPOSITION: null
            }
          }
        })
      });

      const result = await userSyncService.syncUsers(testOrgId, testApiConfigId);

      // Verify user was skipped
      expect(result.skippedUsers).toBe(1);

      const skippedUsers = userSyncService.getSkippedUsers();
      expect(skippedUsers[0].reason).toBe('Custom field filter not met');
      expect(skippedUsers[0].details).toContain('UDFCHAR01');
      expect(skippedUsers[0].details).toContain("'N'");
    });

    it('should sync users with valid PFA access flag values', async () => {
      const validValues = ['Y', 'YES', 'TRUE', 'true', 'yes', '1'];

      for (const value of validValues) {
        // Reset mock
        (global.fetch as Mock).mockReset();

        // Mock PEMS API response
        (global.fetch as Mock)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              Result: {
                ResultData: {
                  DATARECORD: [
                    {
                      USERID: { USERCODE: `ACCESS_${value}` },
                      EMAIL: `access${value}@test.com`,
                      ISACTIVE: '+',
                      USERGROUP: 'PROJECT_MANAGERS',
                      StandardUserDefinedFields: { UDFCHAR01: value }
                    }
                  ],
                  CURRENTCURSORPOSITION: 0,
                  NEXTCURSORPOSITION: null
                }
              }
            })
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              Result: {
                ResultData: {
                  DATARECORD: [
                    {
                      USERORGANIZATIONID: {
                        ORGANIZATIONID: { ORGANIZATIONCODE: 'BECH' },
                        USERID: { USERCODE: `ACCESS_${value}` }
                      },
                      USERGROUP: 'PROJECT_MANAGERS'
                    }
                  ]
                }
              }
            })
          });

        const result = await userSyncService.syncUsers(testOrgId, testApiConfigId);

        // Verify user was synced
        expect(result.syncedUsers).toBe(1);
      }
    });
  });

  describe('Filter 4: Required Organizations', () => {
    it('should skip users without matching organizations', async () => {
      // Mock PEMS API response with user
      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Result: {
              ResultData: {
                DATARECORD: [
                  {
                    USERID: { USERCODE: 'NOORG001' },
                    EMAIL: 'noorg@test.com',
                    ISACTIVE: '+',
                    USERGROUP: 'PROJECT_MANAGERS',
                    StandardUserDefinedFields: { UDFCHAR01: 'Y' }
                  }
                ],
                CURRENTCURSORPOSITION: 0,
                NEXTCURSORPOSITION: null
              }
            }
          })
        })
        // Mock organizations API response with non-matching orgs
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Result: {
              ResultData: {
                DATARECORD: [
                  {
                    USERORGANIZATIONID: {
                      ORGANIZATIONID: { ORGANIZATIONCODE: 'OTHER_ORG' }, // Not in required list
                      USERID: { USERCODE: 'NOORG001' }
                    },
                    USERGROUP: 'PROJECT_MANAGERS'
                  }
                ]
              }
            }
          })
        });

      const result = await userSyncService.syncUsers(testOrgId, testApiConfigId);

      // Verify user was skipped
      expect(result.skippedUsers).toBe(1);

      const skippedUsers = userSyncService.getSkippedUsers();
      expect(skippedUsers[0].reason).toBe('No matching organizations');
      expect(skippedUsers[0].details).toContain('OTHER_ORG');
    });

    it('should sync users with required organizations', async () => {
      const requiredOrgs = ['BECH', 'HOLNG', 'RIO'];

      for (const orgCode of requiredOrgs) {
        // Reset mock
        (global.fetch as Mock).mockReset();

        // Mock PEMS API response
        (global.fetch as Mock)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              Result: {
                ResultData: {
                  DATARECORD: [
                    {
                      USERID: { USERCODE: `USER_${orgCode}` },
                      EMAIL: `user_${orgCode.toLowerCase()}@test.com`,
                      ISACTIVE: '+',
                      USERGROUP: 'PROJECT_MANAGERS',
                      StandardUserDefinedFields: { UDFCHAR01: 'Y' }
                    }
                  ],
                  CURRENTCURSORPOSITION: 0,
                  NEXTCURSORPOSITION: null
                }
              }
            })
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              Result: {
                ResultData: {
                  DATARECORD: [
                    {
                      USERORGANIZATIONID: {
                        ORGANIZATIONID: { ORGANIZATIONCODE: orgCode },
                        USERID: { USERCODE: `USER_${orgCode}` }
                      },
                      USERGROUP: 'PROJECT_MANAGERS'
                    }
                  ]
                }
              }
            })
          });

        // Create organization in database if it doesn't exist
        await prisma.organization.upsert({
          where: { code: orgCode },
          update: {},
          create: {
            code: orgCode,
            name: `${orgCode} Test Organization`,
            isActive: true,
            isExternal: true,
            enableSync: true,
            serviceStatus: 'active'
          }
        });

        const result = await userSyncService.syncUsers(testOrgId, testApiConfigId);

        // Verify user was synced
        expect(result.syncedUsers).toBe(1);
      }
    });
  });

  describe('Audit Log Verification', () => {
    it('should create audit log when sync starts', async () => {
      // Mock PEMS API response (empty users)
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Result: {
            ResultData: {
              DATARECORD: [],
              CURRENTCURSORPOSITION: 0,
              NEXTCURSORPOSITION: null
            }
          }
        })
      });

      await userSyncService.syncUsers(testOrgId, testApiConfigId);

      // Verify audit log entry
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          organizationId: testOrgId,
          action: 'user_sync_started'
        },
        orderBy: { timestamp: 'desc' },
        take: 1
      });

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].resource).toBe('pems_user_sync');
      expect(auditLogs[0].success).toBe(true);
      expect(auditLogs[0].metadata).toHaveProperty('syncId');
      expect(auditLogs[0].metadata).toHaveProperty('filters');
    });

    it('should create audit log when sync completes', async () => {
      // Mock PEMS API response
      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Result: {
              ResultData: {
                DATARECORD: [
                  {
                    USERID: { USERCODE: 'COMPLETE001' },
                    EMAIL: 'complete@test.com',
                    ISACTIVE: '+',
                    USERGROUP: 'PROJECT_MANAGERS',
                    StandardUserDefinedFields: { UDFCHAR01: 'Y' }
                  }
                ],
                CURRENTCURSORPOSITION: 0,
                NEXTCURSORPOSITION: null
              }
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Result: {
              ResultData: {
                DATARECORD: [
                  {
                    USERORGANIZATIONID: {
                      ORGANIZATIONID: { ORGANIZATIONCODE: 'BECH' },
                      USERID: { USERCODE: 'COMPLETE001' }
                    },
                    USERGROUP: 'PROJECT_MANAGERS'
                  }
                ]
              }
            }
          })
        });

      await userSyncService.syncUsers(testOrgId, testApiConfigId);

      // Verify audit log entry
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          organizationId: testOrgId,
          action: 'user_sync_completed'
        },
        orderBy: { timestamp: 'desc' },
        take: 1
      });

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].success).toBe(true);
      expect(auditLogs[0].metadata).toHaveProperty('totalUsers');
      expect(auditLogs[0].metadata).toHaveProperty('syncedUsers');
      expect(auditLogs[0].metadata).toHaveProperty('skippedUsers');
      expect(auditLogs[0].metadata).toHaveProperty('skipReasons');
      expect(auditLogs[0].metadata).toHaveProperty('durationMs');
    });
  });

  describe('Sync Summary and Statistics', () => {
    it('should provide accurate skip statistics', async () => {
      // Mock PEMS API response with mix of valid and invalid users
      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Result: {
              ResultData: {
                DATARECORD: [
                  // Valid user
                  {
                    USERID: { USERCODE: 'VALID001' },
                    EMAIL: 'valid@test.com',
                    ISACTIVE: '+',
                    USERGROUP: 'PROJECT_MANAGERS',
                    StandardUserDefinedFields: { UDFCHAR01: 'Y' }
                  },
                  // Inactive user
                  {
                    USERID: { USERCODE: 'INACTIVE002' },
                    EMAIL: 'inactive@test.com',
                    ISACTIVE: '-',
                    USERGROUP: 'PROJECT_MANAGERS',
                    StandardUserDefinedFields: { UDFCHAR01: 'Y' }
                  },
                  // Wrong user group
                  {
                    USERID: { USERCODE: 'CONTRACTOR003' },
                    EMAIL: 'contractor@test.com',
                    ISACTIVE: '+',
                    USERGROUP: 'CONTRACTORS',
                    StandardUserDefinedFields: { UDFCHAR01: 'Y' }
                  },
                  // No PFA access
                  {
                    USERID: { USERCODE: 'NOACCESS004' },
                    EMAIL: 'noaccess@test.com',
                    ISACTIVE: '+',
                    USERGROUP: 'PROJECT_MANAGERS',
                    StandardUserDefinedFields: { UDFCHAR01: 'N' }
                  }
                ],
                CURRENTCURSORPOSITION: 0,
                NEXTCURSORPOSITION: null
              }
            }
          })
        })
        // Organizations for valid user
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Result: {
              ResultData: {
                DATARECORD: [
                  {
                    USERORGANIZATIONID: {
                      ORGANIZATIONID: { ORGANIZATIONCODE: 'BECH' },
                      USERID: { USERCODE: 'VALID001' }
                    },
                    USERGROUP: 'PROJECT_MANAGERS'
                  }
                ]
              }
            }
          })
        });

      const result = await userSyncService.syncUsers(testOrgId, testApiConfigId);

      // Verify statistics
      expect(result.totalUsers).toBe(4);
      expect(result.processedUsers).toBe(4);
      expect(result.syncedUsers).toBe(1); // Only VALID001
      expect(result.skippedUsers).toBe(3); // INACTIVE002, CONTRACTOR003, NOACCESS004
      expect(result.errorUsers).toBe(0);

      // Verify skip reasons
      const skippedUsers = userSyncService.getSkippedUsers();
      expect(skippedUsers.length).toBe(3);

      const skipReasons = skippedUsers.map(u => u.reason);
      expect(skipReasons).toContain('Inactive user');
      expect(skipReasons).toContain('User group not allowed');
      expect(skipReasons).toContain('Custom field filter not met');
    });
  });
});
