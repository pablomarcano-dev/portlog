import {
  formatNoticeDate,
  formatNoticeDateRange,
  formatCargoFigure,
  resolveTransferRateUnit,
  ordinalDay,
} from '../notice-format';

// These render onto legally binding notices, so the exact output is pinned
// against the agency's legacy reference rather than merely described.

// Local dates: the formatters read calendar parts, matching how the agency
// reads a date off the fixture rather than off a UTC instant.
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('ordinalDay', () => {
  it('zero-pads and suffixes', () => {
    expect(ordinalDay(1)).toBe('01st');
    expect(ordinalDay(2)).toBe('02nd');
    expect(ordinalDay(3)).toBe('03rd');
    expect(ordinalDay(4)).toBe('04th');
    expect(ordinalDay(18)).toBe('18th');
    expect(ordinalDay(31)).toBe('31st');
  });

  it('treats the teens as "th", not as their last digit', () => {
    expect(ordinalDay(11)).toBe('11th');
    expect(ordinalDay(12)).toBe('12th');
    expect(ordinalDay(13)).toBe('13th');
  });
});

describe('formatNoticeDate', () => {
  it('writes the reference form', () => {
    expect(formatNoticeDate(d(2026, 7, 18))).toBe('Jul-18th, 2026');
    expect(formatNoticeDate(d(2026, 8, 2))).toBe('Aug-02nd, 2026');
    expect(formatNoticeDate(d(2026, 7, 5))).toBe('Jul-05th, 2026');
  });

  it('renders empty for a missing date, so the line drops', () => {
    expect(formatNoticeDate(null)).toBe('');
    expect(formatNoticeDate(undefined)).toBe('');
  });
});

describe('formatNoticeDateRange', () => {
  it('repeats the month and writes the year once', () => {
    // Pinned to the Final SOF reference: "Laydays  : Jun. 22nd - Jun. 26th, 2026".
    expect(formatNoticeDateRange(d(2026, 6, 22), d(2026, 6, 26))).toBe(
      'Jun. 22nd - Jun. 26th, 2026',
    );
  });

  it('still writes the year once across a month boundary', () => {
    expect(formatNoticeDateRange(d(2026, 6, 28), d(2026, 7, 2))).toBe(
      'Jun. 28th - Jul. 02nd, 2026',
    );
  });

  it('repeats the year only when the range actually crosses one', () => {
    expect(formatNoticeDateRange(d(2025, 12, 30), d(2026, 1, 2))).toBe(
      'Dec. 30th, 2025 - Jan. 02nd, 2026',
    );
  });

  it('renders a single date, year included, when only one end is set', () => {
    expect(formatNoticeDateRange(d(2026, 7, 6), null)).toBe('Jul. 06th, 2026');
    expect(formatNoticeDateRange(null, d(2026, 7, 10))).toBe('Jul. 10th, 2026');
  });

  it('renders empty when neither end is set', () => {
    expect(formatNoticeDateRange(null, null)).toBe('');
  });
});

describe('formatCargoFigure', () => {
  it('groups with commas and always carries two decimals', () => {
    expect(formatCargoFigure(1950000)).toBe('1,950,000.00');
    expect(formatCargoFigure(1950210)).toBe('1,950,210.00');
    expect(formatCargoFigure(35964)).toBe('35,964.00');
    expect(formatCargoFigure(29051)).toBe('29,051.00');
  });

  it('accepts a numeric string, as parcels JSON often holds', () => {
    expect(formatCargoFigure('1950000')).toBe('1,950,000.00');
  });

  it('rounds to two decimals rather than dropping the tail silently', () => {
    expect(formatCargoFigure(35964.567)).toBe('35,964.57');
  });

  it('renders zero in full, not as a bare 0', () => {
    expect(formatCargoFigure(0)).toBe('0.00');
  });

  it('renders empty for a missing figure, so a blank field prints nothing', () => {
    expect(formatCargoFigure(null)).toBe('');
    expect(formatCargoFigure(undefined)).toBe('');
    expect(formatCargoFigure('')).toBe('');
  });

  it('passes non-numeric text through rather than printing NaN', () => {
    expect(formatCargoFigure('about 2000')).toBe('about 2000');
  });
});

describe('resolveTransferRateUnit', () => {
  it('derives the rate from the cargo unit', () => {
    expect(resolveTransferRateUnit(null, 'Bbls')).toBe('Bbls/Hr');
    // A grain parcel must not be labelled in barrels.
    expect(resolveTransferRateUnit(null, 'MT')).toBe('MT/Hr');
  });

  it('lets an explicitly entered unit win', () => {
    expect(resolveTransferRateUnit('BBLS/HR', 'MT')).toBe('BBLS/HR');
  });

  it('falls back to barrels only when nothing is recorded', () => {
    expect(resolveTransferRateUnit(null, null)).toBe('Bbls/Hr');
    expect(resolveTransferRateUnit('   ', '  ')).toBe('Bbls/Hr');
  });
});
