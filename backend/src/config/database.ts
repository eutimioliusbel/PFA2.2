import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Singleton pattern for Prisma Client
// Initialize immediately to avoid undefined exports
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

// TODO: Re-implement Bronze Layer Immutability Middleware using Prisma v5 extensions
// Currently disabled to diagnose Prisma client issues
// ADR-007: Bronze records should be append-only during normal operations

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('Prisma disconnected');
});

export const getPrismaClient = (): PrismaClient => {
  return prisma;
};

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('✓ Database connected successfully');
  } catch (error) {
    logger.error('✗ Database connection failed:', error);
    process.exit(1);
  }
};

export default prisma;
