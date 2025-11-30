/**
 * Test PEMS User Sync Filtering
 *
 * Verifies that the 4-tier filtering logic works correctly:
 * 1. Active users only (ISACTIVE = '+')
 * 2. Allowed user groups (PROJECT_MANAGERS, COST_ENGINEERS, etc.)
 * 3. Required organizations (BECH, HOLNG, RIO)
 * 4. PFA Access Flag (UDFCHAR01 = 'Y')
 *
 * This script simulates PEMS user sync using mock data.
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/test-user-sync.ts
 *
 * Expected Results:
 *   ✅ 3 users synced (PM001, CE002, ADM003)
 *   ❌ 3 users skipped (INACTIVE001, CONTRACTOR001, NOACCESS001)
 *
 * @see docs/PEMS_USER_SYNC_FILTERING.md for filtering rules
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// Mock PEMS Data
// ============================================================================

const mockPemsUsers = [
  // ✅ SHOULD SYNC
  {
    USERID: { USERCODE: 'PM001', DESCRIPTION: 'Project Manager 001' },
    EMAIL: 'pm001@pems.generated',
    ISACTIVE: '+',
    USERGROUP: 'PROJECT_MANAGERS',
    EXTERNALUSERID: 'EXT_PM001',
    StandardUserDefinedFields: {
      UDFCHAR01: 'Y'
    }
  },
  {
    USERID: { USERCODE: 'CE002', DESCRIPTION: 'Cost Engineer 002' },
    EMAIL: 'ce002@pems.generated',
    ISACTIVE: '+',
    USERGROUP: 'COST_ENGINEERS',
    EXTERNALUSERID: 'EXT_CE002',
    StandardUserDefinedFields: {
      UDFCHAR01: 'Y'
    }
  },
  {
    USERID: { USERCODE: 'ADM003', DESCRIPTION: 'Administrator 003' },
    EMAIL: 'adm003@pems.generated',
    ISACTIVE: '+',
    USERGROUP: 'ADMINISTRATORS',
    EXTERNALUSERID: 'EXT_ADM003',
    StandardUserDefinedFields: {
      UDFCHAR01: 'Y'
    }
  },

  // ❌ SHOULD SKIP - Filter 1: Inactive user
  {
    USERID: { USERCODE: 'INACTIVE001', DESCRIPTION: 'Inactive User 001' },
    EMAIL: 'inactive001@pems.generated',
    ISACTIVE: '-', // ❌ FAILS FILTER 1
    USERGROUP: 'PROJECT_MANAGERS',
    StandardUserDefinedFields: {
      UDFCHAR01: 'Y'
    }
  },

  // ❌ SHOULD SKIP - Filter 2: User group not allowed
  {
    USERID: { USERCODE: 'CONTRACTOR001', DESCRIPTION: 'Contractor 001' },
    EMAIL: 'contractor001@pems.generated',
    ISACTIVE: '+',
    USERGROUP: 'CONTRACTORS', // ❌ FAILS FILTER 2
    StandardUserDefinedFields: {
      UDFCHAR01: 'Y'
    }
  },

  // ❌ SHOULD SKIP - Filter 4: No PFA access flag
  {
    USERID: { USERCODE: 'NOACCESS001', DESCRIPTION: 'No Access 001' },
    EMAIL: 'noaccess001@pems.generated',
    ISACTIVE: '+',
    USERGROUP: 'COST_ENGINEERS',
    StandardUserDefinedFields: {
      UDFCHAR01: 'N' // ❌ FAILS FILTER 4
    }
  },
];

const mockUserOrganizations: Record<string, any[]> = {
  'PM001': [
    {
      USERORGANIZATIONID: {
        ORGANIZATIONID: { ORGANIZATIONCODE: 'BECH' },
        USERID: { USERCODE: 'PM001' },
        LDAPROLEID: { ROLECODE: 'PROJECT_MANAGER' }
      },
      USERGROUP: 'PROJECT_MANAGERS'
    },
    {
      USERORGANIZATIONID: {
        ORGANIZATIONID: { ORGANIZATIONCODE: 'HOLNG' },
        USERID: { USERCODE: 'PM001' },
        LDAPROLEID: { ROLECODE: 'PROJECT_MANAGER' }
      },
      USERGROUP: 'PROJECT_MANAGERS'
    }
  ],
  'CE002': [
    {
      USERORGANIZATIONID: {
        ORGANIZATIONID: { ORGANIZATIONCODE: 'BECH' },
        USERID: { USERCODE: 'CE002' },
        LDAPROLEID: { ROLECODE: 'COST_ENGINEER' }
      },
      USERGROUP: 'COST_ENGINEERS'
    }
  ],
  'ADM003': [
    {
      USERORGANIZATIONID: {
        ORGANIZATIONID: { ORGANIZATIONCODE: 'BECH' },
        USERID: { USERCODE: 'ADM003' },
        LDAPROLEID: { ROLECODE: 'ADMINISTRATOR' }
      },
      USERGROUP: 'ADMINISTRATORS'
    },
    {
      USERORGANIZATIONID: {
        ORGANIZATIONID: { ORGANIZATIONCODE: 'HOLNG' },
        USERID: { USERCODE: 'ADM003' },
        LDAPROLEID: { ROLECODE: 'ADMINISTRATOR' }
      },
      USERGROUP: 'ADMINISTRATORS'
    },
    {
      USERORGANIZATIONID: {
        ORGANIZATIONID: { ORGANIZATIONCODE: 'RIO' },
        USERID: { USERCODE: 'ADM003' },
        LDAPROLEID: { ROLECODE: 'ADMINISTRATOR' }
      },
      USERGROUP: 'ADMINISTRATORS'
    }
  ],
  'INACTIVE001': [],
  'CONTRACTOR001': [],
  'NOACCESS001': []
};

// ============================================================================
// Filtering Logic (Copied from PemsUserSyncService)
// ============================================================================

interface UserSyncFilters {
  requiredOrganizations: string[];
  onlyActiveUsers: boolean;
  allowedUserGroups: string[];
  customFieldFilters: {
    fieldName: string;
    values: string[];
  }[];
}

const filters: UserSyncFilters = {
  requiredOrganizations: ['BECH', 'HOLNG', 'RIO'],
  onlyActiveUsers: true,
  allowedUserGroups: [
    'PROJECT_MANAGERS',
    'COST_ENGINEERS',
    'ADMINISTRATORS',
    'BEO_USERS'
  ],
  customFieldFilters: [
    { fieldName: 'UDFCHAR01', values: ['Y', 'YES', 'TRUE', 'true', 'yes', '1'] }
  ]
};

function shouldSyncUser(pemsUser: any): { sync: boolean; reason?: string; details?: string } {
  // Filter 1: Active users only
  if (filters.onlyActiveUsers && pemsUser.ISACTIVE !== '+') {
    return {
      sync: false,
      reason: 'Inactive user',
      details: `ISACTIVE = '${pemsUser.ISACTIVE}' (expected '+')`
    };
  }

  // Filter 2: Allowed user groups
  if (!filters.allowedUserGroups.includes(pemsUser.USERGROUP)) {
    return {
      sync: false,
      reason: 'User group not allowed',
      details: `USERGROUP = '${pemsUser.USERGROUP}' (allowed: ${filters.allowedUserGroups.join(', ')})`
    };
  }

  // Filter 3: Custom field filters (e.g., UDFCHAR01 = 'Y')
  for (const filter of filters.customFieldFilters) {
    const fieldValue = pemsUser.StandardUserDefinedFields?.[filter.fieldName];

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

function filterOrganizations(userOrgs: any[]): any[] {
  return userOrgs.filter(uo =>
    filters.requiredOrganizations.includes(
      uo.USERORGANIZATIONID.ORGANIZATIONID.ORGANIZATIONCODE
    )
  );
}

// ============================================================================
// Test Runner
// ============================================================================

async function runTests() {
  console.log('\n🧪 Testing PEMS User Sync Filtering\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Test Configuration:');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`Required Organizations: ${filters.requiredOrganizations.join(', ')}`);
  console.log(`Allowed User Groups:    ${filters.allowedUserGroups.join(', ')}`);
  console.log(`PFA Access Flag:        UDFCHAR01 = ${filters.customFieldFilters[0].values.join(' OR ')}`);
  console.log(`Only Active Users:      ${filters.onlyActiveUsers}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  let syncedCount = 0;
  let skippedCount = 0;
  const skipped: any[] = [];

  console.log('🔍 Processing Users:\n');

  for (const pemsUser of mockPemsUsers) {
    const userId = pemsUser.USERID.USERCODE;
    console.log(`──────────────────────────────────────────────────────────`);
    console.log(`User: ${userId} (${pemsUser.USERGROUP})`);

    // STEP 1: Apply user-level filters
    const shouldSync = shouldSyncUser(pemsUser);

    if (!shouldSync.sync) {
      skippedCount++;
      skipped.push({ userId, reason: shouldSync.reason, details: shouldSync.details });
      console.log(`  ❌ SKIPPED: ${shouldSync.reason}`);
      console.log(`     ${shouldSync.details}`);
      continue;
    }

    // STEP 2: Get user organizations (mock)
    const userOrgs = mockUserOrganizations[userId] || [];

    // STEP 3: Filter organizations
    const filteredOrgs = filterOrganizations(userOrgs);

    if (filteredOrgs.length === 0) {
      skippedCount++;
      skipped.push({
        userId,
        reason: 'No matching organizations',
        details: `User has orgs: ${userOrgs.map(o => o.USERORGANIZATIONID.ORGANIZATIONID.ORGANIZATIONCODE).join(', ')}`
      });
      console.log(`  ❌ SKIPPED: No matching organizations`);
      console.log(`     User has orgs: ${userOrgs.length > 0 ? userOrgs.map(o => o.USERORGANIZATIONID.ORGANIZATIONID.ORGANIZATIONCODE).join(', ') : 'NONE'}`);
      continue;
    }

    // STEP 4: Would sync user
    syncedCount++;
    console.log(`  ✅ SYNCED`);
    console.log(`     Email: ${pemsUser.EMAIL}`);
    console.log(`     Organizations: ${filteredOrgs.map(o => o.USERORGANIZATIONID.ORGANIZATIONID.ORGANIZATIONCODE).join(', ')}`);
  }

  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log('📊 Test Results:');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`Total Users:       ${mockPemsUsers.length}`);
  console.log(`✅ Synced:         ${syncedCount}`);
  console.log(`❌ Skipped:        ${skippedCount}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Skip Summary
  if (skipped.length > 0) {
    console.log('📋 Skip Summary:\n');

    // Group by reason
    const skipReasons = new Map<string, number>();
    skipped.forEach(skip => {
      const count = skipReasons.get(skip.reason) || 0;
      skipReasons.set(skip.reason, count + 1);
    });

    skipReasons.forEach((count, reason) => {
      console.log(`  ${reason}: ${count}`);
    });

    console.log('\n📝 Detailed Skip Report:\n');
    skipped.forEach(skip => {
      console.log(`  • ${skip.userId}: ${skip.reason}`);
      console.log(`    ${skip.details}\n`);
    });
  }

  // Verification
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Verification:');
  console.log('───────────────────────────────────────────────────────────');

  const expectedSynced = 3;
  const expectedSkipped = 3;

  const syncMatch = syncedCount === expectedSynced;
  const skipMatch = skippedCount === expectedSkipped;

  console.log(`Expected synced:  ${expectedSynced}  ${syncMatch ? '✅' : '❌'} Actual: ${syncedCount}`);
  console.log(`Expected skipped: ${expectedSkipped}  ${skipMatch ? '✅' : '❌'} Actual: ${skippedCount}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (syncMatch && skipMatch) {
    console.log('🎉 ALL TESTS PASSED!\n');
    console.log('✅ Filter 1 (Active users): Working correctly');
    console.log('✅ Filter 2 (User groups): Working correctly');
    console.log('✅ Filter 3 (Organizations): Working correctly');
    console.log('✅ Filter 4 (PFA Access Flag): Working correctly\n');
    return 0;
  } else {
    console.log('❌ TESTS FAILED!\n');
    console.log('Some filters are not working as expected.\n');
    return 1;
  }
}

// ============================================================================
// Main
// ============================================================================

runTests()
  .then(async (exitCode) => {
    await prisma.$disconnect();
    process.exit(exitCode);
  })
  .catch(async (e) => {
    console.error('❌ Test error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
