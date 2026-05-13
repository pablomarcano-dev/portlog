import { PrismaClient, Role, NominationType, NominationStatus } from '@prisma/client';
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

  const opsEmail = 'ops@portlog.local';
  await prisma.user.upsert({
    where: { email: opsEmail },
    update: {},
    create: {
      email: opsEmail,
      passwordHash: await bcrypt.hash('portlog_ops_dev', 10),
      role: Role.OPS,
      isActive: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded OPS user: ${opsEmail}`);

  // ---------------------------------------------------------------------------
  // Optional: seed sample nominations for M3 dev (M3-S3 list screen)
  // Gated behind SEED_NOMINATIONS=true to avoid interfering with M3-S2 tests.
  // ---------------------------------------------------------------------------
  if (process.env.SEED_NOMINATIONS === 'true') {
    const adminUser = await prisma.user.findUnique({ where: { email } });
    const ship = await prisma.shipParticular.findFirst();
    const port = await prisma.port.findFirst();
    const operator = await prisma.operator.findFirst();
    const owner = await prisma.owner.findFirst();

    if (!adminUser || !ship || !port) {
      // eslint-disable-next-line no-console
      console.warn(
        'SEED_NOMINATIONS=true but required master-data (user/ship/port) not found — skipping nomination seed.',
      );
    } else {
      const existing = await prisma.nomination.findFirst({
        where: { voyageNumber: 'SEED/01' },
      });

      if (!existing) {
        const nomination = await prisma.nomination.create({
          data: {
            voyageNumber: 'SEED/01',
            voyageCode: 'SEA',
            shipParticularId: ship.id,
            opPortId: port.id,
            ...(operator ? { operatorId: operator.id } : {}),
            ...(owner ? { ownerId: owner.id } : {}),
            dateNominated: new Date(),
            nominationType: NominationType.FULL_AGENCY,
            status: NominationStatus.DRAFT,
            features: [],
            createdById: adminUser.id,
          },
        });

        // Insert initial status history row (DRAFT entry, fromStatus null)
        await prisma.nominationStatusHistory.create({
          data: {
            nominationId: nomination.id,
            fromStatus: null,
            toStatus: NominationStatus.DRAFT,
            changedById: adminUser.id,
          },
        });

        // eslint-disable-next-line no-console
        console.log(
          `Seeded sample nomination: ${nomination.id} (correlative ${nomination.correlative})`,
        );
      } else {
        // eslint-disable-next-line no-console
        console.log('Sample nomination already exists — skipping.');
      }
    }
  }
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
