const test = require('node:test');
const assert = require('node:assert/strict');
const { planHandover } = require('./nomination-numbering-handover.cjs');

const manifest = {
  cutoverAt: '2026-12-01T12:00:00Z',
  legacyExportAsOf: '2026-12-01T11:59:00Z',
  legacyExportSha256: 'a'.repeat(64),
  legacySystemReadOnlyConfirmed: true,
  otScope: 'GLOBAL',
  branches: [
    { id: 'plc', code: 'PLC' },
    { id: 'mbo', code: 'MBO' },
  ],
  lastIssued: { SN: 3140, OT: 125 },
};

test('plans independent continuous counters from explicit verified inputs', () => {
  assert.deepEqual(planHandover(manifest).series, [
    { kind: 'SN', scopeKey: '*', nextValue: 3141 },
    { kind: 'OT', scopeKey: '*', nextValue: 126 },
  ]);
  assert.deepEqual(
    planHandover({
      ...manifest,
      otScope: 'BRANCH',
      lastIssued: { SN: 3140, OT: { plc: 125, mbo: 12 } },
    }).series.slice(1),
    [
      { kind: 'OT', scopeKey: 'plc', nextValue: 126 },
      { kind: 'OT', scopeKey: 'mbo', nextValue: 13 },
    ],
  );
});

test('requires cutover, verified export, readonly legacy, explicit OT scope and every branch counter', () => {
  for (const patch of [
    { cutoverAt: '2026-12-01' },
    { legacyExportSha256: '' },
    { legacySystemReadOnlyConfirmed: false },
    { otScope: undefined },
    { otScope: 'BRANCH', lastIssued: { SN: 3140, OT: { plc: 125 } } },
    { lastIssued: { SN: -1, OT: 1 } },
    {
      branches: [
        { id: 'plc', code: 'PLC' },
        { id: 'plc', code: 'JSE' },
      ],
    },
  ])
    assert.throws(() => planHandover({ ...manifest, ...patch }));
});
