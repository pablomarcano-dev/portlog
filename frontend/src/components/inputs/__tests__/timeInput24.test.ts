import { describe, it, expect } from 'vitest';
import { normalizeTime24 } from '../TimeInput24';

describe('normalizeTime24', () => {
  it('keeps a full 24-hour time', () => {
    expect(normalizeTime24('16:00')).toBe('16:00');
    expect(normalizeTime24('00:00')).toBe('00:00');
    expect(normalizeTime24('23:59')).toBe('23:59');
  });

  it('accepts the shorthands people actually type', () => {
    expect(normalizeTime24('7')).toBe('07:00');
    expect(normalizeTime24('16')).toBe('16:00');
    expect(normalizeTime24('730')).toBe('07:30');
    expect(normalizeTime24('1630')).toBe('16:30');
  });

  it('never reads an afternoon time as morning', () => {
    // The bug this replaces: a native <input type="time"> under es-VE showed
    // 16:00 as "04:00 p. m.", which reads as 04:00 on a printed statement.
    expect(normalizeTime24('1600')).toBe('16:00');
    expect(normalizeTime24('0400')).toBe('04:00');
  });

  it('clears an impossible time instead of clamping it', () => {
    // Clamping "2530" to 23:59 would put a wrong timestamp on a legally
    // binding document; an empty box is unmistakable.
    expect(normalizeTime24('2530')).toBe('');
    expect(normalizeTime24('1275')).toBe('');
    expect(normalizeTime24('99')).toBe('');
  });

  it('treats a blank field as no time', () => {
    expect(normalizeTime24('')).toBe('');
    expect(normalizeTime24(':')).toBe('');
  });
});
