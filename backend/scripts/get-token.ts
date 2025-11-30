import { PrismaClient } from '@prisma/client';
import { sign } from 'jsonwebtoken';

const prisma = new PrismaClient();

async function getToken() {
  try {
    const user = await prisma.users.findFirst({
      where: { username: 'admin' }
    });

    if (!user) {
      console.error('Admin user not found');
      process.exit(1);
    }

    const token = sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    console.log(token);
  } finally {
    await prisma.$disconnect();
  }
}

getToken();
