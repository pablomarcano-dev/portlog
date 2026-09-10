const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { exportCatalogs, readFixtures, verifySource, verifyRestored } = require('./catalogs.cjs');
const source = 'postgresql://user:secret@localhost:5432/portlog_test';
const base = {
  comments: 'Notes with áccents',
  createdAt: '2026-09-01T12:00:00.123456+00:00',
  updatedAt: '2026-09-01T12:01:00.654321+00:00',
};
const catalogs = {
  activities: [{ ...base, id: 'activity-1', name: 'Arrival' }],
  cargoes: [
    { ...base, id: 'cargo-1', name: 'Same name', bblUnit: 'MT', category: 'SN' },
    { ...base, id: 'cargo-2', name: 'Same name', bblUnit: 'BBL', category: 'OT' },
  ],
};
function database(rows = catalogs) {
  return {
    $transaction: async (fn) =>
      fn({
        $executeRawUnsafe: async () => 0,
        $queryRawUnsafe: async (sql) =>
          sql.includes('_prisma_migrations')
            ? [{ migration_name: 'baseline' }]
            : rows[sql.includes('"activities"') ? 'activities' : 'cargoes'].map((row) => ({
                row: JSON.stringify(row),
              })),
      }),
  };
}
function directory(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portlog-catalog-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
test('capture preserves full records, duplicate names and timestamp precision without credentials', async (t) => {
  const dir = directory(t);
  await exportCatalogs(database(), source, dir);
  assert.deepEqual(readFixtures(dir).catalogs, catalogs);
  const manifest = fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8');
  assert.ok(!manifest.includes('secret'));
  assert.ok(!manifest.includes('user'));
  await verifySource(database(), source, dir);
  await verifyRestored(database(), dir);
});
test('missing and edited fixtures prevent reset verification', async (t) => {
  const dir = directory(t);
  await assert.rejects(verifySource(database(), source, dir));
  await exportCatalogs(database(), source, dir);
  fs.writeFileSync(
    path.join(dir, 'cargoes.json'),
    JSON.stringify([{ ...catalogs.cargoes[0], category: 'OT' }, catalogs.cargoes[1]]),
  );
  await assert.rejects(verifySource(database(), source, dir), /verification failed/);
});
test('changed live data, wrong targets and incomplete restoration fail verification', async (t) => {
  const dir = directory(t);
  await exportCatalogs(database(), source, dir);
  await assert.rejects(
    verifySource(database(), source.replace('portlog_test', 'another_test'), dir),
    /target differs/,
  );
  const changed = {
    ...catalogs,
    activities: [{ ...catalogs.activities[0], comments: 'Changed after capture' }],
  };
  await assert.rejects(verifySource(database(changed), source, dir), /changed/);
  await assert.rejects(
    verifyRestored(database({ ...catalogs, cargoes: catalogs.cargoes.slice(0, 1) }), dir),
    /differs/,
  );
});
test('empty or structurally invalid sources cannot overwrite a valid capture', async (t) => {
  const dir = directory(t);
  await exportCatalogs(database(), source, dir);
  await assert.rejects(
    exportCatalogs(database({ ...catalogs, activities: [] }), source, dir),
    /empty catalog/,
  );
  await assert.rejects(
    exportCatalogs(
      database({ ...catalogs, activities: [{ ...catalogs.activities[0], unknownColumn: true }] }),
      source,
      dir,
    ),
  );
  assert.deepEqual(readFixtures(dir).catalogs, catalogs);
});
