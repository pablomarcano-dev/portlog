const fs = require('node:fs');
const crypto = require('node:crypto');

function planHandover(manifest) {
  const date = (value, label) => {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) ||
      !Number.isFinite(Date.parse(value))
    )
      throw new Error(`${label} must be an explicit timestamp with timezone`);
    return new Date(value);
  };
  const cutoverAt = date(manifest.cutoverAt, 'cutoverAt');
  const legacyExportAsOf = date(manifest.legacyExportAsOf, 'legacyExportAsOf');
  if (legacyExportAsOf > cutoverAt) throw new Error('Legacy snapshot must not postdate cutover');
  if (manifest.legacySystemReadOnlyConfirmed !== true)
    throw new Error('Confirm the legacy issuer is read-only before activating numbering');
  if (!/^[a-f0-9]{64}$/.test(manifest.legacyExportSha256 ?? ''))
    throw new Error('A verified legacy export SHA-256 is required');
  if (!['GLOBAL', 'BRANCH'].includes(manifest.otScope))
    throw new Error('OT scope must be explicitly GLOBAL or BRANCH');
  if (!Array.isArray(manifest.branches) || !manifest.branches.length)
    throw new Error('Authoritative branch IDs and codes are required');
  const ids = new Set();
  const codes = new Set();
  for (const branch of manifest.branches) {
    if (
      typeof branch.id !== 'string' ||
      !branch.id.trim() ||
      branch.id === '*' ||
      ids.has(branch.id)
    )
      throw new Error('Branch IDs must be nonempty and unique');
    if (!/^[A-Z0-9-]{1,20}$/.test(branch.code ?? '') || codes.has(branch.code))
      throw new Error('Authoritative branch codes must be uppercase and unique');
    ids.add(branch.id);
    codes.add(branch.code);
  }
  const series = [];
  const add = (kind, scopeKey, lastIssued) => {
    if (!Number.isSafeInteger(lastIssued) || lastIssued < 0 || lastIssued >= 2147483646)
      throw new Error(`Verified last-issued number required for ${kind}/${scopeKey}`);
    series.push({ kind, scopeKey, nextValue: lastIssued + 1 });
  };
  add('SN', '*', manifest.lastIssued?.SN);
  if (manifest.otScope === 'GLOBAL') add('OT', '*', manifest.lastIssued?.OT);
  else {
    if (
      !manifest.lastIssued?.OT ||
      typeof manifest.lastIssued.OT !== 'object' ||
      Array.isArray(manifest.lastIssued.OT)
    )
      throw new Error('Branch-scoped OT requires a verified last-issued number per branch');
    if (Object.keys(manifest.lastIssued.OT).some((id) => !ids.has(id)))
      throw new Error('OT counters contain an unrecognized branch');
    for (const id of ids) add('OT', id, manifest.lastIssued.OT[id]);
  }
  return {
    config: {
      id: 'active',
      cutoverAt,
      otScope: manifest.otScope,
      legacyExportSha256: manifest.legacyExportSha256,
      legacyExportAsOf,
    },
    branches: manifest.branches,
    series,
  };
}

async function main(args) {
  const manifestPath = args[0];
  if (!manifestPath || manifestPath.startsWith('--'))
    throw new Error(
      'Usage: node scripts/nomination-numbering-handover.cjs manifest.json [--apply --legacy-export path]',
    );
  const plan = planHandover(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  if (!args.includes('--apply')) {
    process.stdout.write(JSON.stringify({ mode: 'DRY_RUN', ...plan }, null, 2) + '\n');
    return;
  }
  const exportIndex = args.indexOf('--legacy-export');
  if (exportIndex < 0 || !args[exportIndex + 1])
    throw new Error('--legacy-export is required for activation');
  const hash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(args[exportIndex + 1]))
    .digest('hex');
  if (hash !== plan.config.legacyExportSha256)
    throw new Error('Legacy export SHA-256 does not match the verified manifest');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      if (await tx.nominationNumberingConfig.findUnique({ where: { id: 'active' } }))
        throw new Error('Numbering is already configured; refusing to reset or reseed counters');
      for (const branch of plan.branches) {
        const actual = await tx.branch.findUnique({
          where: { id: branch.id },
          select: { code: true },
        });
        if (actual?.code !== branch.code)
          throw new Error(`Reconcile authoritative branch ${branch.id} before activation`);
      }
      await tx.nominationNumberSeries.createMany({ data: plan.series });
      await tx.nominationNumberingConfig.create({ data: plan.config });
    });
    process.stdout.write(
      'Numbering handover configured; historical nominations and internal counters unchanged.\n',
    );
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { planHandover };
if (require.main === module)
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
