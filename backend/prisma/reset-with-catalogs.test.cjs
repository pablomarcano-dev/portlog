const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
test('catalog-only reset fails closed before connecting to a database', () => {
  const result = spawnSync(process.execPath, [require.resolve('./reset-with-catalogs.cjs')], {
    env: { ...process.env, DATABASE_URL: 'invalid://must-not-connect' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No database connection or reset was attempted/);
});
