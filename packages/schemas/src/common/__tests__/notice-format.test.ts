import {
  etaNoticeLabel,
  formatBarrels,
  formatNoticeDate,
  formatNoticeDateRange,
  formatCargoFigure,
  formatQuantity,
  formatTons,
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

describe('formatQuantity', () => {
  it('groups a whole figure', () => {
    expect(formatQuantity('1896870')).toBe('1,896,870');
    expect(formatQuantity('100')).toBe('100');
  });

  it('keeps the decimals exactly as entered, rather than rounding to two', () => {
    // A bill of lading states its own precision — 287,912.375 M/T must not
    // become 287,912.38 the way formatCargoFigure would render it.
    expect(formatQuantity('287912.375')).toBe('287,912.375');
    expect(formatQuantity('286433.4')).toBe('286,433.4');
  });

  it('regroups a figure that already carries commas', () => {
    // Commas are read as thousands separators and the figure is regrouped,
    // rather than passed through the way the old legacy guard did.
    expect(formatQuantity('1,896,870')).toBe('1,896,870');
    expect(formatQuantity('1896,870')).toBe('1,896,870');
    expect(formatQuantity('286433,463')).toBe('286,433,463');
  });

  it('reads "." as the decimal point even alongside thousands commas', () => {
    expect(formatQuantity('287,912.375')).toBe('287,912.375');
    expect(formatQuantity('1,896,870.5')).toBe('1,896,870.5');
    expect(formatQuantity('-1,234.5')).toBe('-1,234.5');
  });

  it('never rounds or re-precisions the digits it regroups', () => {
    // Trailing zeros are part of a stated precision, so they survive.
    expect(formatQuantity('286433.400')).toBe('286,433.400');
    expect(formatQuantity('755553.9')).toBe('755,553.9');
  });

  it('renders empty for a missing figure', () => {
    expect(formatQuantity(null)).toBe('');
    expect(formatQuantity(undefined)).toBe('');
    expect(formatQuantity('   ')).toBe('');
  });

  it('passes non-numeric text through rather than printing NaN', () => {
    expect(formatQuantity('NONE')).toBe('NONE');
  });

  it('handles a negative figure', () => {
    expect(formatQuantity('-1234.5')).toBe('-1,234.5');
  });
});

describe('formatBarrels', () => {
  it('carries no decimals and groups with commas', () => {
    expect(formatBarrels(755553)).toBe('755,553');
    expect(formatBarrels(1950210)).toBe('1,950,210');
    expect(formatBarrels(100)).toBe('100');
  });

  it('truncates the tail rather than rounding it', () => {
    // 755,553.9 must not become 755,554 — that would claim a barrel that was
    // never loaded.
    expect(formatBarrels(755553.9)).toBe('755,553');
    expect(formatBarrels(755553.999)).toBe('755,553');
    expect(formatBarrels(999.5)).toBe('999');
    expect(formatBarrels(0.99)).toBe('0');
  });

  it('accepts a numeric string, as parcels JSON often holds', () => {
    expect(formatBarrels('755553.9')).toBe('755,553');
    expect(formatBarrels('1950210')).toBe('1,950,210');
  });

  it('reads a stored figure that already carries thousands commas', () => {
    expect(formatBarrels('755,553.9')).toBe('755,553');
  });

  it('renders zero plainly', () => {
    expect(formatBarrels(0)).toBe('0');
  });

  it('truncates a negative figure toward zero', () => {
    expect(formatBarrels(-755553.9)).toBe('-755,553');
  });

  it('renders empty for a missing figure, so a blank field prints nothing', () => {
    expect(formatBarrels(null)).toBe('');
    expect(formatBarrels(undefined)).toBe('');
    expect(formatBarrels('')).toBe('');
  });

  it('passes non-numeric text through rather than printing NaN', () => {
    expect(formatBarrels('NONE')).toBe('NONE');
  });
});

describe('formatTons', () => {
  it('carries exactly three decimals and groups with commas', () => {
    expect(formatTons(114375.613)).toBe('114,375.613');
    expect(formatTons(287912.375)).toBe('287,912.375');
  });

  it('pads a whole figure out to three decimals', () => {
    // The trailing zeros are part of the stated precision on an M/T figure.
    expect(formatTons(113460)).toBe('113,460.000');
    expect(formatTons(0)).toBe('0.000');
    expect(formatTons(114375.6)).toBe('114,375.600');
  });

  it('accepts a numeric string, as parcels JSON often holds', () => {
    expect(formatTons('114375.613')).toBe('114,375.613');
    expect(formatTons('113460')).toBe('113,460.000');
  });

  it('reads a stored figure that already carries thousands commas', () => {
    expect(formatTons('114,375.613')).toBe('114,375.613');
  });

  it('writes the decimal point as "." regardless of the environment locale', () => {
    expect(formatTons(1234.5)).toBe('1,234.500');
  });

  it('handles a negative figure', () => {
    expect(formatTons(-1234.5)).toBe('-1,234.500');
  });

  it('renders empty for a missing figure, so a blank field prints nothing', () => {
    expect(formatTons(null)).toBe('');
    expect(formatTons(undefined)).toBe('');
    expect(formatTons('')).toBe('');
  });

  it('passes non-numeric text through rather than printing NaN', () => {
    expect(formatTons('NONE')).toBe('NONE');
  });
});

describe('etaNoticeLabel', () => {
  const NOW = new Date('2026-07-01T00:00:00Z');
  /** An ETA the given number of hours ahead of `NOW`. */
  const etaIn = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);
  const label = (hours: number) => etaNoticeLabel(NOW, etaIn(hours));

  it('counts in whole days beyond four days out', () => {
    expect(label(6 * 24)).toBe('6 DAYS ETA Notice');
    expect(label(5 * 24)).toBe('5 DAYS ETA Notice');
    expect(label(10 * 24)).toBe('10 DAYS ETA Notice');
  });

  it('floors the day count rather than rounding it', () => {
    expect(label(7 * 24 + 5)).toBe('7 DAYS ETA Notice');
    expect(label(7 * 24 + 23.9)).toBe('7 DAYS ETA Notice');
  });

  it('switches from days to hours exactly at 96 hours out', () => {
    // The agency's explicit requirement: four days out is the last notice
    // written in hours, not the first written in days.
    expect(label(96)).toBe('96 Hours ETA Notice');
    expect(label(96 + 1 / 60)).toBe('4 DAYS ETA Notice');
  });

  it('rounds the hours down to the mark already reached', () => {
    expect(label(80)).toBe('72 Hours ETA Notice');
    expect(label(50)).toBe('48 Hours ETA Notice');
    expect(label(30)).toBe('24 Hours ETA Notice');
    expect(label(18)).toBe('12 Hours ETA Notice');
  });

  it('renders each hour mark exactly on its boundary', () => {
    expect(label(96)).toBe('96 Hours ETA Notice');
    expect(label(72)).toBe('72 Hours ETA Notice');
    expect(label(48)).toBe('48 Hours ETA Notice');
    expect(label(24)).toBe('24 Hours ETA Notice');
    expect(label(12)).toBe('12 Hours ETA Notice');
  });

  it('drops to the mark below just under each boundary', () => {
    expect(label(95.99)).toBe('72 Hours ETA Notice');
    expect(label(71.99)).toBe('48 Hours ETA Notice');
    expect(label(47.99)).toBe('24 Hours ETA Notice');
    expect(label(23.99)).toBe('12 Hours ETA Notice');
  });

  it('clamps to the twelve-hour notice below twelve hours out', () => {
    expect(label(11.99)).toBe('12 Hours ETA Notice');
    expect(label(6)).toBe('12 Hours ETA Notice');
    expect(label(0)).toBe('12 Hours ETA Notice');
  });

  it('still titles a notice sent after the ETA has passed', () => {
    expect(label(-1)).toBe('12 Hours ETA Notice');
    expect(label(-240)).toBe('12 Hours ETA Notice');
  });

  it('falls back to the twelve-hour notice on an unusable date', () => {
    expect(etaNoticeLabel(NOW, new Date(NaN))).toBe('12 Hours ETA Notice');
    expect(etaNoticeLabel(new Date(NaN), etaIn(48))).toBe('12 Hours ETA Notice');
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
