/**
 * Integration Test Setup and Utilities
 * ADR-005 Multi-Tenant Access Control - Phase 10B
 *
 * Provides:
 * - Test database setup and cleanup
 * - Test user and organization creation helpers
 * - Authentication token generation
 * - Common test fixtures
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Use a separate test database instance
export const prisma = new PrismaClient();

// JWT secret for test tokens
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-integration-tests';

// Default test password
export const DEFAULT_PASSWORD = 'TestPassword123!';
export const HASHED_DEFAULT_PASSWORD = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

/**
 * User creation options
 */
export interface TestUserOptions {
  username: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'editor' | 'viewer';
  isActive?: boolean;
  authProvider?: 'local' | 'pems';
  serviceStatus?: 'active' | 'suspended' | 'locked';
}

/**
 * Organization creation options
 */
export interface TestOrgOptions {
  code: string;
  name: string;
  isActive?: boolean;
  isExternal?: boolean;
  enableSync?: boolean;
  serviceStatus?: 'active' | 'suspended' | 'archived';
}

/**
 * User-Organization permission options
 */
export interface TestUserOrgOptions {
  userId: string;
  organizationId: string;
  role?: string;
  permissions?: {
    perm_Read?: boolean;
    perm_EditForecast?: boolean;
    perm_EditActuals?: boolean;
    perm_Delete?: boolean;
    perm_Import?: boolean;
    perm_RefreshData?: boolean;
    perm_Export?: boolean;
    perm_ViewFinancials?: boolean;
    perm_SaveDraft?: boolean;
    perm_Sync?: boolean;
    perm_ManageUsers?: boolean;
    perm_ManageSettings?: boolean;
    perm_ConfigureAlerts?: boolean;
    perm_Impersonate?: boolean;
  };
}

/**
 * Create a test user
 */
export async function createTestUser(options: TestUserOptions) {
  const passwordHash = options.password
    ? await bcrypt.hash(options.password, 10)
    : HASHED_DEFAULT_PASSWORD;

  return prisma.user.create({
    data: {
      username: options.username,
      email: options.email || `${options.username}@test.com`,
      passwordHash,
      role: options.role || 'viewer',
      isActive: options.isActive ?? true,
      authProvider: options.authProvider || 'local',
      serviceStatus: options.serviceStatus || 'active',
    },
  });
}

/**
 * Create a test organization
 */
export async function createTestOrg(options: TestOrgOptions) {
  return prisma.organization.create({
    data: {
      code: options.code,
      name: options.name,
      isActive: options.isActive ?? true,
      isExternal: options.isExternal ?? false,
      enableSync: options.enableSync ?? true,
      serviceStatus: options.serviceStatus || 'active',
    },
  });
}

/**
 * Assign user to organization with permissions
 */
export async function assignUserToOrg(options: TestUserOrgOptions) {
  const permissions = options.permissions || {};

  return prisma.userOrganization.create({
    data: {
      userId: options.userId,
      organizationId: options.organizationId,
      role: options.role || 'viewer',
      perm_Read: permissions.perm_Read ?? true,
      perm_EditForecast: permissions.perm_EditForecast ?? false,
      perm_EditActuals: permissions.perm_EditActuals ?? false,
      perm_Delete: permissions.perm_Delete ?? false,
      perm_Import: permissions.perm_Import ?? false,
      perm_RefreshData: permissions.perm_RefreshData ?? false,
      perm_Export: permissions.perm_Export ?? false,
      perm_ViewFinancials: permissions.perm_ViewFinancials ?? false,
      perm_SaveDraft: permissions.perm_SaveDraft ?? false,
      perm_Sync: permissions.perm_Sync ?? false,
      perm_ManageUsers: permissions.perm_ManageUsers ?? false,
      perm_ManageSettings: permissions.perm_ManageSettings ?? false,
      perm_ConfigureAlerts: permissions.perm_ConfigureAlerts ?? false,
      perm_Impersonate: permissions.perm_Impersonate ?? false,
    },
  });
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: {
  id: string;
  username: string;
  role: string;
  email?: string;
}) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Login helper - creates user and returns token
 */
export async function loginAs(
  username: string,
  password: string = DEFAULT_PASSWORD
) {
  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    throw new Error(`User ${username} not found`);
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new Error('Invalid password');
  }

  return generateToken(user);
}

/**
 * Create a complete test scenario with users and org
 */
export async function createTestScenario(prefix: string) {
  // Create organization
  const org = await createTestOrg({
    code: `${prefix}_ORG`,
    name: `${prefix} Test Organization`,
  });

  // Create admin user
  const admin = await createTestUser({
    username: `${prefix}_admin`,
    role: 'admin',
  });

  await assignUserToOrg({
    userId: admin.id,
    organizationId: org.id,
    role: 'admin',
    permissions: {
      perm_Read: true,
      perm_EditForecast: true,
      perm_EditActuals: true,
      perm_Delete: true,
      perm_Import: true,
      perm_RefreshData: true,
      perm_Export: true,
      perm_ViewFinancials: true,
      perm_SaveDraft: true,
      perm_Sync: true,
      perm_ManageUsers: true,
      perm_ManageSettings: true,
      perm_ConfigureAlerts: true,
      perm_Impersonate: true,
    },
  });

  // Create editor user
  const editor = await createTestUser({
    username: `${prefix}_editor`,
    role: 'editor',
  });

  await assignUserToOrg({
    userId: editor.id,
    organizationId: org.id,
    role: 'editor',
    permissions: {
      perm_Read: true,
      perm_EditForecast: true,
      perm_EditActuals: false,
      perm_Export: true,
      perm_ViewFinancials: true,
      perm_SaveDraft: true,
    },
  });

  // Create viewer user
  const viewer = await createTestUser({
    username: `${prefix}_viewer`,
    role: 'viewer',
  });

  await assignUserToOrg({
    userId: viewer.id,
    organizationId: org.id,
    role: 'viewer',
    permissions: {
      perm_Read: true,
    },
  });

  // Generate tokens
  const adminToken = generateToken(admin);
  const editorToken = generateToken(editor);
  const viewerToken = generateToken(viewer);

  return {
    org,
    admin,
    editor,
    viewer,
    adminToken,
    editorToken,
    viewerToken,
  };
}

/**
 * Clean up test data by prefix
 */
export async function cleanupTestScenario(prefix: string) {
  // Delete user-organization mappings
  await prisma.userOrganization.deleteMany({
    where: {
      OR: [
        { user: { username: { startsWith: prefix } } },
        { organization: { code: { startsWith: prefix } } },
      ],
    },
  });

  // Delete users
  await prisma.user.deleteMany({
    where: { username: { startsWith: prefix } },
  });

  // Delete organizations
  await prisma.organization.deleteMany({
    where: { code: { startsWith: prefix } },
  });

  // Delete API servers
  await prisma.apiServer.deleteMany({
    where: { name: { startsWith: prefix } },
  });

  // Delete audit logs
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { metadata: { path: ['testPrefix'], equals: prefix } },
      ],
    },
  });
}

/**
 * Global cleanup function
 */
export async function globalCleanup() {
  await prisma.$disconnect();
}

/**
 * Default permission sets for different roles
 */
export const PERMISSION_SETS = {
  admin: {
    perm_Read: true,
    perm_EditForecast: true,
    perm_EditActuals: true,
    perm_Delete: true,
    perm_Import: true,
    perm_RefreshData: true,
    perm_Export: true,
    perm_ViewFinancials: true,
    perm_SaveDraft: true,
    perm_Sync: true,
    perm_ManageUsers: true,
    perm_ManageSettings: true,
    perm_ConfigureAlerts: true,
    perm_Impersonate: true,
  },
  editor: {
    perm_Read: true,
    perm_EditForecast: true,
    perm_EditActuals: false,
    perm_Delete: false,
    perm_Import: false,
    perm_RefreshData: false,
    perm_Export: true,
    perm_ViewFinancials: true,
    perm_SaveDraft: true,
    perm_Sync: false,
    perm_ManageUsers: false,
    perm_ManageSettings: false,
    perm_ConfigureAlerts: false,
    perm_Impersonate: false,
  },
  viewer: {
    perm_Read: true,
    perm_EditForecast: false,
    perm_EditActuals: false,
    perm_Delete: false,
    perm_Import: false,
    perm_RefreshData: false,
    perm_Export: false,
    perm_ViewFinancials: false,
    perm_SaveDraft: false,
    perm_Sync: false,
    perm_ManageUsers: false,
    perm_ManageSettings: false,
    perm_ConfigureAlerts: false,
    perm_Impersonate: false,
  },
} as const;

/**
 * API response status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
} as const;
