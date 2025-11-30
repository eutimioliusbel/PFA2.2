/**
 * Minimal Prisma Test - Direct Execution
 * Run: npx tsx test-prisma-direct.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  console.log('=== PRISMA DIRECT TEST ===');
  console.log('1. Prisma object type:', typeof prisma);
  console.log('2. Prisma has user property:', 'user' in prisma);
  console.log('3. prisma.user exists:', !!prisma.user);
  console.log('4. prisma.user type:', typeof prisma.user);

  if (prisma.user) {
    console.log('5. Attempting to query users...');
    const users = await prisma.user.findMany({
      take: 1,
      select: { id: true, username: true }
    });
    console.log('6. Success! Found users:', users.length);
    console.log('7. First user:', users[0]);
  } else {
    console.log('5. ERROR: prisma.user is undefined!');
  }

  await prisma.$disconnect();
}

test().catch(console.error);
