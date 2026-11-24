import {
  DEFAULT_SOF_SUBJECT_LABELS,
  sofActivitySubject,
  sofSubjectActivityInputSchema,
  suggestSofSubjectActivity,
} from '../sof-subject-activities';
const catalog = [
  { id: 'pilot', label: 'Pilot On Board', eventNames: ['Pilot boarded'], active: true },
  { id: 'fast', label: 'All Fast', eventNames: [], active: true },
];
const event = (activityName: string | null, occurredAt = '2026-11-24T10:00:00Z') => ({
  activityName,
  occurredAt,
});
describe('SOF activity subjects', () => {
  it('retains the 16 supplied subject labels', () =>
    expect(DEFAULT_SOF_SUBJECT_LABELS).toHaveLength(16));
  it('replaces statement and prior activity suffixes without duplication', () => {
    expect(
      sofActivitySubject('FOREVER SN3092/26/MBO - Interim Statement of Facts', 'All Fast'),
    ).toBe('FOREVER SN3092/26/MBO :: All Fast');
    expect(sofActivitySubject('Edited base :: Pilot On Board', 'All Fast')).toBe(
      'Edited base :: All Fast',
    );
  });
  it('suggests from the latest timestamp rather than array ordering', () => {
    expect(
      suggestSofSubjectActivity(catalog, [
        event('All Fast'),
        event('Pilot boarded', '2026-11-24T09:00:00Z'),
      ]),
    ).toBe('fast');
  });
  it('requires a choice for unknown, empty, inactive, aliased-collision or conflicting tied events', () => {
    expect(suggestSofSubjectActivity(catalog, [])).toBeNull();
    expect(
      suggestSofSubjectActivity(catalog, [
        event('Unknown'),
        event('All Fast', '2026-11-24T09:00:00Z'),
      ]),
    ).toBeNull();
    expect(
      suggestSofSubjectActivity(catalog, [event('All Fast'), event('Pilot On Board')]),
    ).toBeNull();
    expect(suggestSofSubjectActivity(catalog, [event(null)])).toBeNull();
    expect(
      suggestSofSubjectActivity(
        catalog.map((i) => ({ ...i, active: false })),
        [event('All Fast')],
      ),
    ).toBeNull();
    expect(
      suggestSofSubjectActivity(
        [...catalog, { ...catalog[0]!, id: 'duplicate', eventNames: ['All Fast'] }],
        [event('All Fast')],
      ),
    ).toBeNull();
  });
  it('allows tied latest entries only when they map to the same activity', () =>
    expect(
      suggestSofSubjectActivity(catalog, [event('Pilot On Board'), event('Pilot boarded')]),
    ).toBe('pilot'));
  it('rejects multiline/empty labels and unknown catalog write fields', () => {
    expect(sofSubjectActivityInputSchema.safeParse({ label: 'A\nB' }).success).toBe(false);
    expect(sofSubjectActivityInputSchema.safeParse({ label: ' ', active: true }).success).toBe(
      false,
    );
    expect(
      sofSubjectActivityInputSchema.safeParse({ label: 'All Fast', role: 'ADM' }).success,
    ).toBe(false);
  });
});
