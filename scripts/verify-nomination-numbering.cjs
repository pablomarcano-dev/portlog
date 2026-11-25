// Local acceptance only. Uses an isolated temporary schema, then removes it.
const assert = require('node:assert/strict');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
require('ts-node').register({
  project: path.resolve(__dirname, '../backend/tsconfig.json'),
  transpileOnly: true,
});
const { issueNominationReference } = require('../backend/src/nominations/nomination-numbering.ts');

async function main() {
  const value = process.env.NUMBERING_TEST_DATABASE_URL;
  if (!value)
    throw new Error('Set NUMBERING_TEST_DATABASE_URL to a disposable local PostgreSQL database');
  const url = new URL(value);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/requirements|numbering|test|qa/i.test(url.pathname)
  )
    throw new Error('Only an explicitly named disposable local test database is allowed');
  const schema = `nvm_numbering_qa_${process.pid}_${Date.now()}`;
  const admin = new PrismaClient({ datasourceUrl: value });
  url.searchParams.set('schema', schema);
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  const now = new Date('2026-12-01T12:00:00Z');
  const input = { kind: 'SN', branchId: 'plc', branchCode: 'PLC', dateNominated: now };
  const issue = (data = input) =>
    db.$transaction((tx) => issueNominationReference(tx, data, now), {
      maxWait: 15000,
      timeout: 20000,
    });
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await admin.$executeRawUnsafe(`CREATE TYPE "${schema}"."NominationKind" AS ENUM ('SN','OT')`);
    await admin.$executeRawUnsafe(
      `CREATE TYPE "${schema}"."NominationOtScope" AS ENUM ('GLOBAL','BRANCH')`,
    );
    await admin.$executeRawUnsafe(
      `CREATE TABLE "${schema}"."nomination_numbering_config" ("id" TEXT PRIMARY KEY, "cutoverAt" TIMESTAMPTZ NOT NULL, "otScope" "${schema}"."NominationOtScope" NOT NULL, "legacyExportSha256" TEXT NOT NULL, "legacyExportAsOf" TIMESTAMPTZ NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now())`,
    );
    await admin.$executeRawUnsafe(
      `CREATE TABLE "${schema}"."nomination_number_series" ("kind" "${schema}"."NominationKind" NOT NULL, "scopeKey" TEXT NOT NULL, "nextValue" INTEGER NOT NULL CHECK ("nextValue">0), PRIMARY KEY("kind","scopeKey"))`,
    );
    assert.equal(await issue(), null, 'absent handover preserves legacy creation');
    await db.nominationNumberingConfig.create({
      data: {
        id: 'active',
        cutoverAt: now,
        otScope: 'GLOBAL',
        legacyExportSha256: 'a'.repeat(64),
        legacyExportAsOf: now,
      },
    });
    await db.nominationNumberSeries.createMany({
      data: [
        { kind: 'SN', scopeKey: '*', nextValue: 3141 },
        { kind: 'OT', scopeKey: '*', nextValue: 126 },
      ],
    });
    const references = await Promise.all(
      Array.from({ length: 20 }, (_, n) =>
        issue({ ...input, branchId: n % 2 ? 'mbo' : 'plc', branchCode: n % 2 ? 'MBO' : 'PLC' }),
      ),
    );
    const numbers = references.map((ref) => Number(ref.match(/^SN(\d+)/)[1])).sort((a, b) => a - b);
    assert.deepEqual(
      numbers,
      Array.from({ length: 20 }, (_, n) => 3141 + n),
      'national SN issuance must be unique and continuous under concurrency',
    );
    assert.equal(
      await issue({ ...input, kind: 'OT' }),
      'OT0126/26/PLC',
      'OT has its own initialized counter',
    );
    const before = await db.nominationNumberSeries.findUnique({
      where: { kind_scopeKey: { kind: 'SN', scopeKey: '*' } },
    });
    await assert.rejects(
      db.$transaction(async (tx) => {
        await issueNominationReference(tx, input, now);
        throw new Error('synthetic-create-failure');
      }),
      /synthetic-create-failure/,
    );
    assert.deepEqual(
      await db.nominationNumberSeries.findUnique({
        where: { kind_scopeKey: { kind: 'SN', scopeKey: '*' } },
      }),
      before,
      'nomination failure must roll back issuance',
    );
    assert.equal(
      await issue({ ...input, dateNominated: new Date('2027-01-01T00:00:00Z') }),
      'SN3161/27/PLC',
      'year changes without resetting the sequence',
    );
    await db.nominationNumberingConfig.update({
      where: { id: 'active' },
      data: { otScope: 'BRANCH' },
    });
    await assert.rejects(
      issue({ ...input, kind: 'OT' }),
      /not initialized/,
      'missing branch series must fail closed',
    );
    await db.nominationNumberSeries.createMany({
      data: [
        { kind: 'OT', scopeKey: 'plc', nextValue: 201 },
        { kind: 'OT', scopeKey: 'mbo', nextValue: 51 },
      ],
    });
    assert.equal(await issue({ ...input, kind: 'OT' }), 'OT0201/26/PLC');
    assert.equal(
      await issue({ ...input, kind: 'OT', branchId: 'mbo', branchCode: 'MBO' }),
      'OT0051/26/MBO',
    );
    process.stdout.write(
      'PASS: inactive gate, 20 concurrent national SNs, independent/global/branch OT, year continuity and transaction rollback.\n',
    );
  } finally {
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  }
}
main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
