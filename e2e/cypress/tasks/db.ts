import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasourceUrl: process.env['E2E_DATABASE_URL'],
});

export async function resetDb(): Promise<null> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE audit_log, refresh_tokens,
      "Flag", "Activity", "Cargo", "User"
    RESTART IDENTITY CASCADE
  `);
  const [admHash, opsHash] = await Promise.all([
    bcrypt.hash('portlog_admin_dev', 10),
    bcrypt.hash('portlog_ops_dev', 10),
  ]);
  await prisma.user.createMany({
    data: [
      { email: 'admin@portlog.local', passwordHash: admHash, role: 'ADM', isActive: true },
      { email: 'ops@portlog.local', passwordHash: opsHash, role: 'OPS', isActive: true },
    ],
  });
  return null;
}
