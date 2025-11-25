import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Singleton pattern for Prisma Client
let prisma: PrismaClient;

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    });

    // Graceful shutdown
    process.on('beforeExit', async () => {
      await prisma.$disconnect();
      logger.info('Prisma disconnected');
    });
  }

  return prisma;
};

export const connectDatabase = async (): Promise<void> => {
  try {
    const client = getPrismaClient();
    await client.$connect();
    logger.info('✓ Database connected successfully');
  } catch (error) {
    logger.error('✗ Database connection failed:', error);
    process.exit(1);
  }
};

export default getPrismaClient();
