import { describe, it, expect } from 'vitest';
import { sanitizeQuantity } from '../QuantityInput';

describe('sanitizeQuantity', () => {
  it('keeps digits and a single decimal point', () => {
    expect(sanitizeQuantity('1896870')).toBe('1896870');
    expect(sanitizeQuantity('287912.375')).toBe('287912.375');
  });

  it('strips anything that is not part of a number', () => {
    expect(sanitizeQuantity('12a3')).toBe('123');
    expect(sanitizeQuantity('1 234 MT')).toBe('1234');
  });

  it('reads a typed comma as the decimal point', () => {
    // The agency's figures come off Spanish-locale paperwork where
    // "286433,463" means 286433.463 — dropping the comma would multiply the
    // figure by a thousand.
    expect(sanitizeQuantity('286433,463')).toBe('286433.463');
  });

  it('collapses extra decimal points rather than producing an unparseable value', () => {
    expect(sanitizeQuantity('1.2.3')).toBe('1.23');
  });

  it('allows a leading minus only', () => {
    expect(sanitizeQuantity('-1234.5')).toBe('-1234.5');
    expect(sanitizeQuantity('12-34')).toBe('1234');
  });

  it('allows a part-typed decimal so the point can be typed at all', () => {
    expect(sanitizeQuantity('287912.')).toBe('287912.');
  });

  it('leaves a cleared field empty', () => {
    expect(sanitizeQuantity('')).toBe('');
  });
});
