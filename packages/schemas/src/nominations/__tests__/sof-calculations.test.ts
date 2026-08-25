import { calculateSofOperations, formatSofDuration } from '../sof-calculations.js';

describe('SOF operational calculations', () => {
  const entry = (occurredAt: string, name: string) => ({ occurredAt, activity: { name } });

  it('calculates gross and net time without double-counting overlapping delays', () => {
    const result = calculateSofOperations(
      [
        entry('2026-06-18T13:00:00', 'Commenced Loading'),
        entry('2026-06-18T23:00:00', 'Completed Loading'),
      ],
      [
        {
          beginDate: '2026-06-18',
          beginTime: '14:00',
          endDate: '2026-06-18',
          endTime: '16:00',
          delayCategory: 'DURING',
        },
        {
          beginDate: '2026-06-18',
          beginTime: '15:00',
          endDate: '2026-06-18',
          endTime: '17:00',
          delayCategory: 'DURING',
        },
      ],
      '10,000',
      '1,000',
    );
    expect(formatSofDuration(result.grossOperationMs)).toBe('10h 00m');
    expect(formatSofDuration(result.delaysDuringMs)).toBe('3h 00m');
    expect(formatSofDuration(result.netOperationMs)).toBe('7h 00m');
    expect(result.averageRate).toBeCloseTo(1285.714, 3);
  });
});
