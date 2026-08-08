import { describe, it, expect } from 'vitest';
import { formatNoticeDate } from '@portlog/schemas';
import {
  CARGO_FIGURE_WIDTH,
  alignCargoFigure,
  cargoFigureLine,
  cargoUpdateSubject,
  etaCountdownLabel,
  withEtaNoticeLabel,
} from '../noticeText';

const HOUR = 3_600_000;
const NOW = new Date(2026, 7, 8, 12, 0);

/** `now` plus `hours`, i.e. an ETA that far out. */
function etaIn(hours: number): Date {
  return new Date(NOW.getTime() + hours * HOUR);
}

// ---------------------------------------------------------------------------
// etaCountdownLabel
// ---------------------------------------------------------------------------

describe('etaCountdownLabel', () => {
  it('counts a distant ETA down in whole days', () => {
    expect(etaCountdownLabel(etaIn(6 * 24), NOW)).toBe('6 DAYS ETA Notice');
  });

  it('switches to hour marks at four days out', () => {
    expect(etaCountdownLabel(etaIn(96), NOW)).toBe('96 Hours ETA Notice');
  });

  it('rounds down to the mark already reached', () => {
    // 80 hours out, the 96-hour notice has already gone; this one is the 72.
    expect(etaCountdownLabel(etaIn(80), NOW)).toBe('72 Hours ETA Notice');
    expect(etaCountdownLabel(etaIn(30), NOW)).toBe('24 Hours ETA Notice');
  });

  it('still titles a late notice rather than counting backwards', () => {
    expect(etaCountdownLabel(etaIn(-5), NOW)).toBe('12 Hours ETA Notice');
  });

  it('returns null when the nomination has no ETA', () => {
    // The caller leaves the composed subject alone rather than sending a
    // legally binding notice titled "NaN Hours".
    expect(etaCountdownLabel(null, NOW)).toBeNull();
    expect(etaCountdownLabel(undefined, NOW)).toBeNull();
  });

  it('returns null for an unparseable ETA', () => {
    expect(etaCountdownLabel(new Date('nonsense'), NOW)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// withEtaNoticeLabel
// ---------------------------------------------------------------------------

describe('withEtaNoticeLabel', () => {
  const REF = 'CP-8891 - MT ALFA-1 - Calling to Jose SN1522/26/JSE';

  it('re-titles the reply to master, keeping the reference line', () => {
    expect(withEtaNoticeLabel(`${REF} - 96 Hours ETA Notice`, '6 DAYS ETA Notice')).toBe(
      `${REF} - 6 DAYS ETA Notice`,
    );
  });

  it('re-titles the terminal notice', () => {
    expect(withEtaNoticeLabel(`${REF} - ETA Forwarded to Terminal`, '72 Hours ETA Notice')).toBe(
      `${REF} - 72 Hours ETA Notice`,
    );
  });

  it('keeps hyphens inside the reference line', () => {
    // "MT ALFA-1" and the charter reference both carry hyphens; only the notice
    // phrase at the end is replaced.
    expect(withEtaNoticeLabel(`${REF} - 24 Hours ETA Notice`, '12 Hours ETA Notice')).toContain(
      'MT ALFA-1 - Calling to Jose SN1522/26/JSE',
    );
  });

  it('is idempotent once the subject already carries a countdown', () => {
    const once = withEtaNoticeLabel(`${REF} - ETA Forwarded to Terminal`, '6 DAYS ETA Notice');
    expect(withEtaNoticeLabel(once, '6 DAYS ETA Notice')).toBe(once);
  });

  it('appends rather than truncating an unrecognised subject', () => {
    // Guessing that everything after the last dash is the notice phrase would
    // eat "Calling to Jose SN1522/26/JSE" — the reference every mail is filed
    // under.
    expect(withEtaNoticeLabel(REF, '48 Hours ETA Notice')).toBe(`${REF} - 48 Hours ETA Notice`);
  });

  it('does not double the separator when the template left its title empty', () => {
    expect(withEtaNoticeLabel(`${REF} - `, '48 Hours ETA Notice')).toBe(
      `${REF} - 48 Hours ETA Notice`,
    );
  });

  it('falls back to the vessel name when no draft was composed', () => {
    expect(withEtaNoticeLabel('', '48 Hours ETA Notice', 'MT ALFA-1')).toBe(
      'MT ALFA-1 - 48 Hours ETA Notice',
    );
  });

  it('returns the bare label when there is nothing to title', () => {
    expect(withEtaNoticeLabel('', '48 Hours ETA Notice')).toBe('48 Hours ETA Notice');
  });
});

// ---------------------------------------------------------------------------
// cargoUpdateSubject
// ---------------------------------------------------------------------------

describe('cargoUpdateSubject', () => {
  const REF = 'CP-8891 - MT ALFA-1 - Calling to Jose SN1522/26/JSE';
  // What the server composes: the template's Subject comment, stamped with the
  // clock at compose time.
  const COMPOSED = `${REF} - Cargo Update Aug-05th, 2026 19:35 Hrs`;

  it('re-stamps the subject with the dialog Date Update / Time', () => {
    expect(cargoUpdateSubject(COMPOSED, new Date(2026, 6, 13), '00:01')).toBe(
      `${REF} - Cargo Update Jul-13th, 2026 00:01 Hrs`,
    );
  });

  it('states the same moment the body block states', () => {
    // The reported fault: subject "Aug-05th, 2026 19:35" over a body reading
    // "Jul-13th, 2026 00:01". Both are built from these two fields now.
    const date = new Date(2026, 6, 13);
    const time = '00:01';
    const bodyStamp = `${formatNoticeDate(date)} ${time}`;
    expect(cargoUpdateSubject(COMPOSED, date, time)).toContain(bodyStamp);
  });

  it('keeps the time exactly as typed, 24-hour', () => {
    expect(cargoUpdateSubject(COMPOSED, new Date(2026, 6, 13), '19:35')).toContain('19:35 Hrs');
    expect(cargoUpdateSubject(COMPOSED, new Date(2026, 6, 13), '19:35')).not.toMatch(/[AP]M/i);
  });

  it('is idempotent', () => {
    const once = cargoUpdateSubject(COMPOSED, new Date(2026, 6, 13), '00:01');
    expect(cargoUpdateSubject(once, new Date(2026, 6, 13), '00:01')).toBe(once);
  });

  it('drops "Hrs" when no time was entered', () => {
    expect(cargoUpdateSubject(COMPOSED, new Date(2026, 6, 13), '  ')).toBe(
      `${REF} - Cargo Update Jul-13th, 2026`,
    );
  });

  it('stamps the time alone when the date was cleared', () => {
    expect(cargoUpdateSubject(COMPOSED, null, '00:01')).toBe(`${REF} - Cargo Update 00:01 Hrs`);
  });

  it('leaves the bare marker when both fields are empty', () => {
    expect(cargoUpdateSubject(COMPOSED, null, '')).toBe(`${REF} - Cargo Update`);
  });

  it('appends the stamp to a subject that carries no marker', () => {
    expect(cargoUpdateSubject(REF, new Date(2026, 6, 13), '00:01')).toBe(
      `${REF} - Cargo Update Jul-13th, 2026 00:01 Hrs`,
    );
  });

  it('stands alone when no draft was composed', () => {
    expect(cargoUpdateSubject('', new Date(2026, 6, 13), '00:01')).toBe(
      'Cargo Update Jul-13th, 2026 00:01 Hrs',
    );
  });
});

// ---------------------------------------------------------------------------
// Figure column
// ---------------------------------------------------------------------------

describe('alignCargoFigure', () => {
  it('pins the column to the width the backend template pads to', () => {
    // `backend/templates/_partials/figure_col.hbs`, used by
    // `02_statement_of_facts/07_cargo_update.hbs`, whose header and tail wrap
    // this block in the same email.
    expect(CARGO_FIGURE_WIDTH).toBe(14);
  });

  it('right-aligns a figure into the column', () => {
    expect(alignCargoFigure(1_950_210)).toBe('  1,950,210.00');
    expect(alignCargoFigure(29_051)).toBe('     29,051.00');
    expect(alignCargoFigure(1_950_210)).toHaveLength(CARGO_FIGURE_WIDTH);
    expect(alignCargoFigure(29_051)).toHaveLength(CARGO_FIGURE_WIDTH);
  });

  it('keeps the grouped two-decimal form', () => {
    expect(alignCargoFigure(1_900_000).trim()).toBe('1,900,000.00');
    expect(alignCargoFigure(0).trim()).toBe('0.00');
  });

  it('overflows rather than truncating an oversized figure', () => {
    // A misaligned line is cosmetic; a clipped quantity is wrong.
    expect(alignCargoFigure(123_456_789_012).trim()).toBe('123,456,789,012.00');
  });
});

describe('cargoFigureLine', () => {
  const lines = [
    cargoFigureLine('Quantity', 1_900_000, 'Bbls'),
    cargoFigureLine('Quantity On Board', 1_950_210, 'Bbls'),
    cargoFigureLine('Quantity To Go', 0, 'Bbls'),
    cargoFigureLine('Loading Rate', 29_051, 'Bbls/Hr'),
  ];

  it('writes the label column the template writes', () => {
    expect(cargoFigureLine('Quantity', 1_900_000, 'Bbls')).toBe(
      'Quantity         :   1,900,000.00 Bbls',
    );
    expect(cargoFigureLine('Quantity On Board', 1_950_210, 'Bbls')).toBe(
      'Quantity On Board:   1,950,210.00 Bbls',
    );
    // Byte-identical to the sample in backend/templates/_partials/figure_col.hbs
    expect(cargoFigureLine('Quantity On Board', 950_000, 'Bbls')).toBe(
      'Quantity On Board:     950,000.00 Bbls',
    );
    expect(cargoFigureLine('Loading Rate', 25_000, 'Bbls/Hr')).toBe(
      'Loading Rate     :      25,000.00 Bbls/Hr',
    );
  });

  it('stacks every decimal point in the same column', () => {
    const columns = lines.map((line) => line.indexOf('.'));
    expect(new Set(columns).size).toBe(1);
  });

  it('stacks the unit suffixes too', () => {
    const columns = lines.map((line) => line.indexOf(' Bbls'));
    expect(new Set(columns).size).toBe(1);
  });

  it('leaves the trailing space the template leaves when a parcel has no unit', () => {
    expect(cargoFigureLine('Quantity', 1_900_000, '')).toBe('Quantity         :   1,900,000.00 ');
  });
});
