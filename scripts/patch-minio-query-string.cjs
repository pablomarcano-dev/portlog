// MinIO 8 imports query-string 7's CommonJS namespace. The supported, patched
// query-string 10 exposes the same stringify API as a default export. Adapt
// both published MinIO builds without retaining the vulnerable legacy decoder.
const fs = require('node:fs');
const path = require('node:path');

let entry;
try {
  entry = require.resolve('minio');
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') process.exit(0); // frontend-only build
  throw error;
}
const root = path.resolve(path.dirname(entry), '../..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (version !== '8.0.7') throw new Error('Review the query-string adapter for this MinIO version');
const replacements = [
  [
    'dist/main/internal/client.js',
    'var qs = _interopRequireWildcard(require("query-string"), true);',
    'var qs = require("query-string").default;',
  ],
  [
    'dist/main/helpers.js',
    'var querystring = _interopRequireWildcard(require("query-string"), true);',
    'var querystring = require("query-string").default;',
  ],
  [
    'dist/esm/internal/client.mjs',
    "import * as qs from 'query-string';",
    "import qs from 'query-string';",
  ],
  [
    'dist/esm/helpers.mjs',
    "import * as querystring from 'query-string';",
    "import querystring from 'query-string';",
  ],
];
for (const [relative, before, after] of replacements) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(after)) continue;
  if (!source.includes(before)) throw new Error(`Unexpected MinIO dependency source: ${relative}`);
  fs.writeFileSync(file, source.replace(before, after));
}
