import {
  operationalUpdateComposeQuerySchema,
  operationalUpdateInstant,
  operationalUpdateSubject,
  suggestOperationalUpdateMode,
} from '../operational-update.js';
import { sendNominationEmailSchema, sendSubDocumentSchema } from '../../dispatch/index.js';

const at = new Date('2026-11-24T10:05:00Z');
const event = (activityName: string, occurredAt = at) => ({ activityName, occurredAt });
describe('operational update modes', () => {
  it.each([
    ['ANCHOR', 'Update at Anchor'],
    ['ALONGSIDE', 'Update at Alongside'],
    ['CARGO', 'Cargo Update'],
  ] as const)('formats %s with the same agency stamp', (mode, label) => {
    expect(operationalUpdateSubject('SN3092/26/MBO', mode, at)).toBe(
      `SN3092/26/MBO - ${label} 24.11.2026 06:10 Hrs`,
    );
    expect(operationalUpdateSubject('SN3092/26/MBO', mode, at, false)).toContain('06:05 Hrs');
  });
  it('suggests only a recognized latest saved operational event', () => {
    expect(suggestOperationalUpdateMode([event('Anchored Aw. Berth Availability')])).toBe('ANCHOR');
    expect(suggestOperationalUpdateMode([event('All Fast')])).toBe('ALONGSIDE');
    expect(suggestOperationalUpdateMode([event('Commenced Loading')])).toBe('CARGO');
    expect(suggestOperationalUpdateMode([event('Completed Loading')])).toBe('ALONGSIDE');
    expect(
      suggestOperationalUpdateMode([
        event('Commenced Loading', new Date('2026-11-23T10:05:00Z')),
        event('Unknown activity'),
      ]),
    ).toBeNull();
  });
  it('requires a choice for missing, invalid or conflicting latest state', () => {
    expect(suggestOperationalUpdateMode([])).toBeNull();
    expect(suggestOperationalUpdateMode([event('IN_PORT')])).toBeNull();
    expect(
      suggestOperationalUpdateMode([event('All Fast'), event('Commenced Loading')]),
    ).toBeNull();
    expect(
      suggestOperationalUpdateMode([{ activityName: 'All Fast', occurredAt: 'bad' }]),
    ).toBeNull();
  });
  it('does not mutate events when suggesting a mode', () => {
    const events = [event('All Fast')];
    const before = JSON.stringify(events);
    suggestOperationalUpdateMode(events);
    expect(JSON.stringify(events)).toBe(before);
  });
  it('resolves a typed Caracas wall time independently from host timezone', () => {
    expect(operationalUpdateInstant(new Date(2026, 10, 24), '06:05').toISOString()).toBe(
      '2026-11-24T10:05:00.000Z',
    );
    expect(() => operationalUpdateInstant(new Date(2026, 10, 24), '25:00')).toThrow();
  });
  it('validates compose options and routes plain operational updates honestly', () => {
    expect(operationalUpdateComposeQuerySchema.safeParse({ mode: 'CARGO' }).success).toBe(false);
    expect(
      operationalUpdateComposeQuerySchema.safeParse({ mode: 'ANCHOR', at: 'bad' }).success,
    ).toBe(false);
    const body = {
      subDocType: 'OPERATIONAL_UPDATE',
      toAddresses: ['client@example.test'],
      subject: 'An edited subject',
    };
    expect(sendNominationEmailSchema.parse(body).subject).toBe('An edited subject');
    expect(sendSubDocumentSchema.safeParse(body).success).toBe(false);
  });
});
