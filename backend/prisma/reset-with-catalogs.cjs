/** Run after stopping all writers. A verified live capture is mandatory. */
const path = require('node:path');
const { spawnSync } = require('node:child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const { verifySource, verifyRestored, sourceIdentity } = require('./catalogs.cjs');
async function main() {
  if (
    process.env.DIRECT_URL &&
    JSON.stringify(sourceIdentity(process.env.DIRECT_URL)) !==
      JSON.stringify(sourceIdentity(process.env.DATABASE_URL))
  )
    throw new Error(
      'DIRECT_URL and DATABASE_URL must identify the same captured database before reset.',
    );
  const prisma = new PrismaClient();
  try {
    await verifySource(prisma, process.env.DATABASE_URL);
  } finally {
    await prisma.$disconnect();
  }
  function run(args) {
    const result = spawnSync('npx', args, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: process.env,
    });
    if (result.error || result.status !== 0)
      throw new Error(
        'Database setup command failed. Preserve the catalog fixtures before retrying.',
      );
  }
  run(['prisma', 'generate']);
  run(['prisma', 'migrate', 'reset', '--force', '--skip-seed', '--skip-generate']);
  run(['prisma', 'db', 'seed']);
  const restored = new PrismaClient();
  try {
    await verifyRestored(restored);
  } finally {
    await restored.$disconnect();
  }
  console.log('Database reset and seeded; live Activities and Cargoes match the capture.');
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
