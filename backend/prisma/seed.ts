import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = 'admin@portlog.local';
  const plainPassword = 'portlog_admin_dev';
  const saltRounds = 12;

  const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      role: Role.ADM,
      isActive: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded ADM user: ${email}`);
}

main()
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
