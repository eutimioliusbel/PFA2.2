/**
 * Organization Validation Service
 * Phase 2, Task 2.1 - Validates organization status before operations
 *
 * Ensures operations are blocked if organization is:
 * - Not found
 * - Inactive (isActive = false)
 * - Service status is not 'active' (suspended, archived)
 */

import prisma from '../config/database';
import { logger } from '../utils/logger';
import { OrganizationValidationResult } from '../types/auth';

/**
 * Custom error for organization not found
 */
export class OrganizationNotFoundException extends Error {
  constructor(organizationId: string) {
    super(`Organization not found: ${organizationId}`);
    this.name = 'OrganizationNotFoundException';
  }
}

/**
 * Custom error for inactive/suspended organization
 */
export class OrganizationInactiveException extends Error {
  public organizationCode: string;
  public serviceStatus: string;

  constructor(organizationCode: string, serviceStatus: string, operation: string) {
    super(`Cannot ${operation} - Organization ${organizationCode} is ${serviceStatus}`);
    this.name = 'OrganizationInactiveException';
    this.organizationCode = organizationCode;
    this.serviceStatus = serviceStatus;
  }
}

/**
 * Organization Validation Service
 */
export class OrganizationValidationService {
  /**
   * Validate organization is active and service status is 'active'
   *
   * @param organizationId - Organization UUID
   * @param operation - Operation being attempted (for error message)
   * @returns Organization data if valid
   * @throws OrganizationNotFoundException if org not found
   * @throws OrganizationInactiveException if org is inactive or suspended
   */
  static async validateOrgActive(
    organizationId: string,
    operation: string
  ): Promise<OrganizationValidationResult> {
    try {
      const org = await prisma.organizations.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          code: true,
          serviceStatus: true,
          isActive: true,
        },
      });

      if (!org) {
        logger.warn(`Organization validation failed: Not found - ${organizationId}`);
        throw new OrganizationNotFoundException(organizationId);
      }

      // Check if organization is active
      if (!org.isActive) {
        logger.warn(`Organization validation failed: ${org.code} is inactive`);
        throw new OrganizationInactiveException(org.code, 'inactive', operation);
      }

      // Check service status
      if (org.serviceStatus !== 'active') {
        logger.warn(
          `Organization validation failed: ${org.code} service status is ${org.serviceStatus}`
        );
        throw new OrganizationInactiveException(org.code, org.serviceStatus, operation);
      }

      logger.debug(`Organization validation passed: ${org.code}`);
      return org;
    } catch (error) {
      // Re-throw known errors
      if (
        error instanceof OrganizationNotFoundException ||
        error instanceof OrganizationInactiveException
      ) {
        throw error;
      }

      // Log and re-throw unexpected errors
      logger.error('Organization validation error:', error);
      throw error;
    }
  }

  /**
   * Validate organization exists (no status check)
   * Used for read-only operations where org status doesn't matter
   *
   * @param organizationId - Organization UUID
   * @returns Organization data if exists
   * @throws OrganizationNotFoundException if org not found
   */
  static async validateOrgExists(
    organizationId: string
  ): Promise<OrganizationValidationResult> {
    try {
      const org = await prisma.organizations.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          code: true,
          serviceStatus: true,
          isActive: true,
        },
      });

      if (!org) {
        logger.warn(`Organization not found: ${organizationId}`);
        throw new OrganizationNotFoundException(organizationId);
      }

      return org;
    } catch (error) {
      if (error instanceof OrganizationNotFoundException) {
        throw error;
      }

      logger.error('Organization validation error:', error);
      throw error;
    }
  }

  /**
   * Batch validate multiple organizations
   * Useful for multi-org queries
   *
   * @param organizationIds - Array of organization UUIDs
   * @returns Map of orgId -> validation result
   */
  static async validateOrgsActive(
    organizationIds: string[]
  ): Promise<Map<string, OrganizationValidationResult>> {
    try {
      const orgs = await prisma.organizations.findMany({
        where: {
          id: { in: organizationIds },
        },
        select: {
          id: true,
          code: true,
          serviceStatus: true,
          isActive: true,
        },
      });

      // Create map of valid orgs
      const validOrgs = new Map<string, OrganizationValidationResult>();

      for (const org of orgs) {
        if (org.isActive && org.serviceStatus === 'active') {
          validOrgs.set(org.id, org);
        }
      }

      return validOrgs;
    } catch (error) {
      logger.error('Batch organization validation error:', error);
      throw error;
    }
  }
}

export default OrganizationValidationService;
