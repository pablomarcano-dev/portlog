import {
  calculateSofOperations,
  formatSofDuration,
  resolveSofCargoInputs,
} from '../sof-calculations.js';

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
    expect(result.operationFrom).toBe(new Date('2026-06-18T13:00:00').getTime());
    expect(result.operationTo).toBe(new Date('2026-06-18T23:00:00').getTime());
    expect(formatSofDuration(result.delaysDuringMs)).toBe('3h 00m');
    expect(formatSofDuration(result.netOperationMs)).toBe('7h 00m');
    expect(result.averageRate).toBeCloseTo(1285.714, 3);
  });

  it('recognises the master-data turnaround aliases and classifies legacy remarks by time', () => {
    const result = calculateSofOperations(
      [
        entry('2026-07-05T16:00:00', 'End of Sea Passed'),
        entry('2026-07-12T13:42:00', 'Commenced Loading'),
        entry('2026-07-18T10:00:00', 'Completed Loading'),
        entry('2026-07-19T12:36:00', 'Sailed Full Away'),
      ],
      [
        {
          beginDate: '2026-07-10',
          beginTime: '16:12',
          endDate: '2026-07-11',
          endTime: '00:42',
        },
        {
          beginDate: '2026-07-18',
          beginTime: '06:00',
          endDate: '2026-07-18',
          endTime: '08:00',
        },
        {
          beginDate: '2026-07-18',
          beginTime: '15:30',
          endDate: '2026-07-18',
          endTime: '16:42',
        },
      ],
    );

    expect(result.turnaroundFrom).toBe(new Date('2026-07-05T16:00:00').getTime());
    expect(result.turnaroundTo).toBe(new Date('2026-07-19T12:36:00').getTime());
    expect(formatSofDuration(result.delaysBeforeMs)).toBe('8h 30m');
    expect(formatSofDuration(result.delaysDuringMs)).toBe('2h 00m');
    expect(formatSofDuration(result.delaysAfterMs)).toBe('1h 12m');
  });

  it('sources cargo and OBQ from all saved SOF figure columns', () => {
    expect(
      resolveSofCargoInputs(
        { rows: { bbls: ['755,553', '1,141,317'] } },
        { rows: { originalOnBoard: ['1,000', '476'] } },
        '999',
        '888',
      ),
    ).toEqual({
      cargoQuantity: '1896870',
      obq: '1476',
      cargoSource: 'SHIP_FIGURES',
      obqSource: 'BL_FIGURES',
    });
  });

  it('keeps manual values for legacy SOFs without linked figures', () => {
    expect(resolveSofCargoInputs(null, null, '1,896,870', '1,476')).toEqual({
      cargoQuantity: '1,896,870',
      obq: '1,476',
      cargoSource: 'MANUAL',
      obqSource: 'MANUAL',
    });
  });
});
