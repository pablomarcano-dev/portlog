/* eslint-disable no-console -- This is an interactive maintenance CLI. */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const isExplicitTestUser = (email: string, displayName: string | null) => {
  const local = email.toLowerCase().split('@')[0] ?? '';
  const name = displayName?.trim().toLowerCase() ?? '';
  return /^test\d*$/.test(local) || ['test', 'test user', 'usuario prueba'].includes(name);
};

async function main() {
  const candidates = (
    await prisma.user.findMany({
      select: { id: true, email: true, displayName: true },
      orderBy: { email: 'asc' },
    })
  ).filter((user) => isExplicitTestUser(user.email, user.displayName));

  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', candidates }, null, 2));
    console.log('Re-run with --apply to delete only these explicit test identities.');
    return;
  }

  const deleted: string[] = [];
  const retained: Array<{ email: string; reason: string }> = [];
  for (const user of candidates) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.refreshToken.deleteMany({ where: { userId: user.id } });
        await tx.user.delete({ where: { id: user.id } });
      });
      deleted.push(user.email);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        retained.push({ email: user.email, reason: 'Referenced by operational history' });
        continue;
      }
      throw error;
    }
  }
  console.log(JSON.stringify({ mode: 'apply', deleted, retained }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
