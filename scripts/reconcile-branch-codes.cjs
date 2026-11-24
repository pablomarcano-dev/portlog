#!/usr/bin/env node
// Reads an explicit local export only. No database connection, SQL or write mode exists.
const { readFileSync } = require('node:fs');
const { reconcileNavieramarBranchCodes } = require('@portlog/schemas');

const args = process.argv.slice(2);
if (args.length !== 1 || args[0] === '--help') {
  process.stdout.write(
    'Usage: npm run --silent branches:reconcile -- branches.json\n' +
      'Build @portlog/schemas first. Input: complete unfiltered array or {items, hasMore:false, nextCursor:null}.\n' +
      'Read-only JSON report. Exit 0: all eight mappings match; 2: review required; 1: invalid input.\n',
  );
  process.exitCode = args[0] === '--help' ? 0 : 1;
} else {
  try {
    const report = reconcileNavieramarBranchCodes(JSON.parse(readFileSync(args[0], 'utf8')));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.requiresReview ? 2 : 0;
  } catch (error) {
    process.stderr.write(`Branch reconciliation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
