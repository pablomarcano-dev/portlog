import type { PrismaClient } from '@prisma/client';

export function readFixtures(directory?: string): unknown;
export function restoreCatalogs(prisma: PrismaClient, directory?: string): Promise<void>;
