import {
  calculateSofOperations,
  formatSofDuration,
  parseSofAmount,
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

  it('recognises master-data aliases and applies the legacy HAKKAISAN delay rules', () => {
    const result = calculateSofOperations(
      [
        entry('2026-07-05T16:00:00', 'End of Sea Passed'),
        entry('2026-07-05T18:30:00', 'Notice of Readiness Tendered'),
        entry('2026-07-06T08:20:00', 'Anchor Aweigh'),
        entry('2026-07-12T04:24:00', 'Anchor Aweigh'),
        entry('2026-07-12T13:42:00', 'Commenced Loading'),
        entry('2026-07-18T10:00:00', 'Completed Loading'),
        entry('2026-07-19T14:00:00', 'Sailed Full Away'),
      ],
      [
        {
          remark: 'Anchored Aw. Berth Availability',
          beginDate: '2026-07-06',
          beginTime: '11:48',
          endDate: '2026-07-12',
          endTime: '04:24',
        },
        {
          remark: 'Aw. Terminal Readiness',
          comment: 'to Resume Loading',
          beginDate: '2026-07-14',
          beginTime: '08:48',
          endDate: '2026-07-14',
          endTime: '14:01',
        },
        {
          remark: 'Aw. Terminal Readiness',
          comment: 'to Resume Loading',
          beginDate: '2026-07-15',
          beginTime: '04:48',
          endDate: '2026-07-16',
          endTime: '00:54',
        },
        {
          remark: 'Terminal stopped Loading',
          comment: 'Due To Lightning & Thunder Storm',
          beginDate: '2026-07-17',
          beginTime: '19:42',
          endDate: '2026-07-17',
          endTime: '21:30',
        },
        {
          remark: 'Aw. Terminal Readiness',
          comment: 'to Resume Loading',
          beginDate: '2026-07-18',
          beginTime: '07:12',
          endDate: '2026-07-18',
          endTime: '09:12',
        },
        {
          remark: 'Underwater Inspection',
          beginDate: '2026-07-19',
          beginTime: '09:30',
          endDate: '2026-08-12',
          endTime: '04:00',
        },
      ],
      '1,898,014.000',
      '1,476',
    );

    expect(result.turnaroundFrom).toBe(new Date('2026-07-05T16:00:00').getTime());
    expect(result.turnaroundTo).toBe(new Date('2026-07-19T14:00:00').getTime());
    expect(formatSofDuration(result.delaysBeforeMs)).toBe('6d 9h 54m');
    expect(formatSofDuration(result.delaysDuringMs)).toBe('1d 5h 07m');
    expect(formatSofDuration(result.delaysAfterMs)).toBe('1d 4h 00m');
    expect(formatSofDuration(result.netOperationMs)).toBe('4d 15h 11m');
    expect(result.netCargo).toBe(1_896_538);
    expect(result.averageRate).toBeCloseTo(17_057.75, 2);
  });

  it('treats the three zero decimals stored by ship figures as decimals, not thousands', () => {
    expect(parseSofAmount('1898014.000')).toBe(1_898_014);
    expect(parseSofAmount('1,898,014.000')).toBe(1_898_014);
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
