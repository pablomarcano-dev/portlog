import {
  NAVIERAMAR_BRANCH_CODES,
  NAVIERAMAR_LEGACY_PROCEDURE_BRANCH_CODES,
  reconcileNavieramarBranchCodes,
} from '../branch';

const complete = () =>
  NAVIERAMAR_BRANCH_CODES.map((row, index) => ({ ...row, id: `branch-${index}` }));

describe('Navieramar business branch code reconciliation', () => {
  it('recognizes all seven revised mappings without mutating the export', () => {
    const rows = complete();
    const before = JSON.stringify(rows);
    const report = reconcileNavieramarBranchCodes(rows);
    expect(report.matchedCount).toBe(7);
    expect(report.requiresReview).toBe(false);
    expect(report.mappings.map((row) => row.expected.code)).toEqual([
      'MBO',
      'PFJ',
      'PBO',
      'LGR',
      'CRN',
      'PLC',
      'GRA',
    ]);
    expect(report.mappings.find((row) => row.expected.code === 'PLC')?.expected.name).toBe(
      'Puerto La Cruz y Jose',
    );
    expect(report.guidance.previousMappings).toEqual(NAVIERAMAR_LEGACY_PROCEDURE_BRANCH_CODES);
    expect(report.guidance.previousMappings).toHaveLength(8);
    expect(report.legacyConflicts).toEqual([]);
    expect(JSON.stringify(rows)).toBe(before);
  });

  it('matches accents, capitalization and whitespace but retains original display names', () => {
    const rows = complete().map((row) => ({
      ...row,
      name: ` ${row.name.normalize('NFKD').replace(/\p{M}/gu, '').toUpperCase()}  `,
      code: row.code.toLowerCase(),
    }));
    expect(reconcileNavieramarBranchCodes(rows).matchedCount).toBe(7);
  });

  it('flags an unrelated JSE instead of treating the code as branch identity', () => {
    const report = reconcileNavieramarBranchCodes([
      { id: 'demo', name: 'José Ignacio', code: 'JSE' },
    ]);
    expect(report.mappings.some((row) => row.expected.code === ('JSE' as string))).toBe(false);
    expect(report.legacyConflicts[0]?.row).toEqual({
      id: 'demo',
      name: 'José Ignacio',
      code: 'JSE',
    });
    expect(report.unmapped).toHaveLength(1);
  });

  it('reports missing branches without inventing rows', () => {
    const report = reconcileNavieramarBranchCodes([]);
    expect(report.mappings).toHaveLength(7);
    expect(
      report.mappings.every((row) => row.status === 'missing' && row.candidates.length === 0),
    ).toBe(true);
    expect(report.requiresReview).toBe(true);
  });

  it('reports a named branch with a wrong or blank code for manual review', () => {
    for (const code of ['WRONG', '']) {
      const report = reconcileNavieramarBranchCodes([{ id: 'real', name: 'Maracaibo', code }]);
      expect(report.mappings[0]?.status).toBe('code_mismatch');
      expect(report.mappings[0]?.candidates[0]?.code).toBe(code);
    }
  });

  it('rejects duplicate branch names and duplicate codes as ambiguous', () => {
    for (const duplicate of [
      { id: 'other', name: 'MARACAIBO', code: 'OTHER' },
      { id: 'other', name: 'Other branch', code: 'MBO' },
    ]) {
      const report = reconcileNavieramarBranchCodes([...complete(), duplicate]);
      expect(report.mappings[0]?.status).toBe('conflict');
    }
  });

  it('rejects repeated database IDs even if the rows otherwise look valid', () => {
    const rows = complete();
    rows[1]!.id = rows[0]!.id;
    const report = reconcileNavieramarBranchCodes(rows);
    expect(report.mappings[0]?.status).toBe('conflict');
    expect(report.mappings[1]?.status).toBe('conflict');
  });

  it('accepts complete endpoint envelopes and excludes unrelated private fields', () => {
    const report = reconcileNavieramarBranchCodes({
      items: complete().map((row) => ({ ...row, emails: ['private@example.test'] })),
      hasMore: false,
      nextCursor: null,
    });
    expect(report.matchedCount).toBe(7);
    expect(JSON.stringify(report)).not.toContain('private@example.test');
  });

  it('requires manual review of separate José rows even when all current branches match', () => {
    for (const legacy of [
      { id: 'legacy-jse', name: 'José', code: 'JSE' },
      { id: 'legacy-jose', name: 'JOSE', code: 'OLD' },
      { id: 'legacy-demo', name: 'José Ignacio', code: 'jse' },
    ]) {
      const rows = [...complete(), legacy];
      const before = JSON.stringify(rows);
      const report = reconcileNavieramarBranchCodes(rows);
      expect(report.matchedCount).toBe(7);
      expect(report.requiresReview).toBe(true);
      expect(report.legacyConflicts).toHaveLength(1);
      expect(report.legacyConflicts[0]?.row).toEqual(legacy);
      expect(report.legacyConflicts[0]?.reason).toContain('before any merge');
      expect(JSON.stringify(rows)).toBe(before);
    }
  });

  it('reports the old eight-entry procedure as a conflict rather than an automatic merge', () => {
    const rows = NAVIERAMAR_LEGACY_PROCEDURE_BRANCH_CODES.map((row, index) => ({
      ...row,
      id: `legacy-${index}`,
    }));
    const before = JSON.stringify(rows);
    const report = reconcileNavieramarBranchCodes(rows);
    expect(report.matchedCount).toBe(6);
    expect(report.requiresReview).toBe(true);
    expect(report.mappings.find((row) => row.expected.code === 'PLC')?.status).toBe('conflict');
    expect(report.legacyConflicts).toHaveLength(2);
    expect(JSON.stringify(rows)).toBe(before);
  });

  it('rejects incomplete cursor pages and malformed exports', () => {
    for (const input of [
      { items: complete(), hasMore: true },
      { items: complete(), nextCursor: 'more' },
      [{ name: 42, code: 'JSE' }],
      { notItems: [] },
    ]) {
      expect(() => reconcileNavieramarBranchCodes(input)).toThrow();
    }
  });
});
