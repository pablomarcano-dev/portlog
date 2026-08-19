import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasourceUrl: process.env['E2E_DATABASE_URL'],
});

export async function resetDb(): Promise<null> {
  // Physical table names, not model names: every model here carries an @@map to
  // snake_case plural. This read "audit_log", "Flag", "Activity", "Cargo",
  // "User" — none of which exist — so resetDb threw 42P01 in the before() hook
  // of every spec, which is what took the whole E2E suite down from 2026-05-22.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE audit_logs, refresh_tokens,
      flags, activities, cargoes, users
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

// ---------------------------------------------------------------------------
// ETA recipient fixture
// ---------------------------------------------------------------------------

/**
 * Every address here is on a `.test` domain (RFC 2606 — guaranteed never to
 * resolve) and each one is unique to the role it plays, so an assertion can
 * tell "the vessel's address" from "the charterer's" without ambiguity. Seed
 * data is deliberately not reused: which seeded vessel happens to carry an
 * owner today is not something this behaviour should depend on.
 */
export const ETA_FIXTURE = {
  vesselEmail: 'master@e2e-vessel.test',
  operatorEmail: 'operator-box@e2e-operator.test',
  operatorContactEmail: 'operator-contact@e2e-operator.test',
  ownerContactEmail: 'owner-contact@e2e-owner.test',
  chartererTo: 'charterer@e2e-charterer.test',
  chartererCc: 'charterer-cc@e2e-charterer.test',
  operatorName: 'E2E Operator Ltd',
  ownerName: 'E2E Owner AS',
  chartererName: 'E2E Charterer SA',
  masterName: 'CAPT E2E TESTER',
  vesselWithEmail: 'MV E2E RECIPIENT',
  vesselWithoutEmail: 'MV E2E NOEMAIL',
  flagName: 'E2E TEST FLAG',
} as const;

export async function cleanupEtaRecipientFixture(): Promise<null> {
  // Children first: nominations reference the vessels, contacts reference the
  // owner/operator. NominationClient rows cascade with their nomination.
  await prisma.nomination.deleteMany({
    where: {
      shipParticular: {
        name: { in: [ETA_FIXTURE.vesselWithEmail, ETA_FIXTURE.vesselWithoutEmail] },
      },
    },
  });
  await prisma.shipParticular.deleteMany({
    where: { name: { in: [ETA_FIXTURE.vesselWithEmail, ETA_FIXTURE.vesselWithoutEmail] } },
  });
  await prisma.contact.deleteMany({
    where: {
      emails: { hasSome: [ETA_FIXTURE.operatorContactEmail, ETA_FIXTURE.ownerContactEmail] },
    },
  });
  await prisma.operator.deleteMany({ where: { name: ETA_FIXTURE.operatorName } });
  await prisma.owner.deleteMany({ where: { name: ETA_FIXTURE.ownerName } });
  await prisma.flag.deleteMany({ where: { name: ETA_FIXTURE.flagName } });
  return null;
}

/**
 * Builds two nominations that differ in exactly one respect — whether the
 * vessel has an address on file — so the spec can prove both the new
 * vessel-addressed path and the fallback without a second variable moving.
 */
export async function seedEtaRecipientFixture(): Promise<{
  withEmail: string;
  withoutEmail: string;
}> {
  await cleanupEtaRecipientFixture();

  const operator = await prisma.operator.create({
    data: { name: ETA_FIXTURE.operatorName, emails: [ETA_FIXTURE.operatorEmail] },
  });
  const owner = await prisma.owner.create({ data: { name: ETA_FIXTURE.ownerName } });

  // Owner has no `emails` column of its own — its contacts are the only way to
  // reach it, which is why the service reads owner.contacts[].emails.
  await prisma.contact.create({
    data: {
      name: 'E2E Operator Contact',
      emails: [ETA_FIXTURE.operatorContactEmail],
      operatorId: operator.id,
    },
  });
  await prisma.contact.create({
    data: { name: 'E2E Owner Contact', emails: [ETA_FIXTURE.ownerContactEmail], ownerId: owner.id },
  });

  // resetDb truncates flags, and a vessel cannot exist without one, so the
  // fixture brings its own rather than assuming seed data survived.
  const flag = await prisma.flag.upsert({
    where: { name: ETA_FIXTURE.flagName },
    update: {},
    create: { name: ETA_FIXTURE.flagName, abbreviation: 'E2E' },
  });

  // callSign is unique, so the two vessels cannot share one.
  const makeVessel = (name: string, callSign: string, emails: string[]) =>
    prisma.shipParticular.create({
      data: {
        name,
        emails,
        callSign,
        flagId: flag.id,
        ownerId: owner.id,
        operatorId: operator.id,
      },
    });

  const vesselA = await makeVessel(ETA_FIXTURE.vesselWithEmail, 'E2ERCP1', [
    ETA_FIXTURE.vesselEmail,
  ]);
  const vesselB = await makeVessel(ETA_FIXTURE.vesselWithoutEmail, 'E2ERCP2', []);

  // A nomination records who raised it. resetDb runs first and recreates this
  // user, so look it up rather than hardcoding an id that changes every reset.
  const author = await prisma.user.findUniqueOrThrow({ where: { email: 'ops@portlog.local' } });

  // No branchId: a branch appends its own Cc/Bcc, which would blur the
  // assertions without exercising anything this spec is about.
  const makeNomination = (shipParticularId: string, voyageNumber: string) =>
    prisma.nomination.create({
      data: {
        shipParticularId,
        voyageNumber,
        createdById: author.id,
        dateNominated: new Date(),
        // Five days out, so the countdown label is in days rather than hours.
        etaDate: new Date(Date.now() + 5 * 24 * 3_600_000),
        master: ETA_FIXTURE.masterName,
        emailTo: [ETA_FIXTURE.chartererTo],
        emailCc: [ETA_FIXTURE.chartererCc],
        nominationClients: {
          create: [
            { type: 'Head Owner', name: ETA_FIXTURE.ownerName, sortOrder: 0 },
            { type: 'Commercial Operator', name: ETA_FIXTURE.operatorName, sortOrder: 1 },
            { type: 'Charterer', name: ETA_FIXTURE.chartererName, sortOrder: 2 },
          ],
        },
      },
    });

  const nomA = await makeNomination(vesselA.id, '01/E2E-RCP');
  const nomB = await makeNomination(vesselB.id, '02/E2E-RCP');

  return { withEmail: nomA.id, withoutEmail: nomB.id };
}
