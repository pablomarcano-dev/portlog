import { describe, expect, it } from 'vitest';
import { changelogEntries, CHANGELOG_STATUS } from './data';

describe('changelog editorial contract', () => {
  it('keeps calendar dates stable and entries uniquely ordered newest first', () => {
    const dates = changelogEntries.map((entry) => entry.date);
    expect(new Set(changelogEntries.map((entry) => entry.id)).size).toBe(changelogEntries.length);
    expect(dates).toEqual([...dates].sort().reverse());
    for (const entry of changelogEntries) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.timeZone).toBe('America/Montevideo');
      expect(entry.sections.length).toBeGreaterThan(0);
      expect(new Set(entry.sections.map((section) => section.id)).size).toBe(entry.sections.length);
      for (const section of entry.sections) {
        expect(CHANGELOG_STATUS[section.status]).toBeDefined();
        expect(section.items.length).toBeGreaterThan(0);
      }
    }
  });

  it('preserves the October 15 evidence boundaries and approved deferrals', () => {
    const entry = changelogEntries.find((item) => item.date === '2026-10-15')!;
    expect(entry.dateLabel).toBe('15 de octubre de 2026');
    expect(entry.deployment).toBe('deployed');
    expect(entry.releaseNote).toContain('Desplegado en producción el 19 de octubre de 2026');
    expect(entry.releaseNote).toContain('no equivalen a una validación completa');
    expect(entry.qaSummary).toEqual({ verified: 10, partial: 1, deferred: 2 });
    expect(entry.sections.find((section) => section.id === 'preservation')?.status).toBe(
      'verified-production',
    );
    const deferred = entry.sections.find((section) => section.status === 'deferred');
    expect(deferred?.items).toHaveLength(2);
    expect(deferred?.items.join(' ')).toContain('Pre-Arrival');
    expect(deferred?.items.join(' ')).toContain('Reply to Client');
  });
});
