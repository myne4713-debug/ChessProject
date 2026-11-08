import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export let isDatabaseConnected = false;

export async function seedSystemUsers(): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await prisma.user.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        username: 'ai_engine',
        email: 'ai-engine@system.local',
        displayName: 'StockAI',
        bio: 'Động cơ cờ vua tự động',
        role: 'PLAYER',
        eloRating: 1500,
        isEmailVerified: true,
        accountStatus: 'ACTIVE',
      },
    });

    await prisma.user.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        username: 'guest_user',
        email: 'guest@system.local',
        displayName: 'Khách',
        bio: 'Người chơi khách',
        role: 'GUEST',
        eloRating: 1200,
        isEmailVerified: true,
        accountStatus: 'ACTIVE',
      },
    });
    logger.info('System users (AI_ENGINE and GUEST_USER) verified in database');
  } catch (err) {
    logger.warn(err, 'Failed to ensure system users in database');
  }
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    isDatabaseConnected = true;
    logger.info('Database connected successfully (PostgreSQL via Prisma)');
    await seedSystemUsers();
    return true;
  } catch (error) {
    isDatabaseConnected = false;
    logger.warn('PostgreSQL database not reachable. Running in resilient memory-store mode.');
    return false;
  }
}
