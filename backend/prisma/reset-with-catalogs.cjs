/** Disabled: a catalog-only capture cannot restore operational records. */
console.error(
  'Reset blocked: catalog snapshots do not preserve operational records. ' +
    'Use a reviewed, data-preserving migration with a verified full backup and restore rehearsal. ' +
    'No database connection or reset was attempted.',
);
process.exitCode = 1;
