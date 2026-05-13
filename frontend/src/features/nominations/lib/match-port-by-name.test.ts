import { describe, it, expect } from 'vitest';
import { matchPortByName } from './match-port-by-name';

const PORTS = [
  { id: '1', name: 'Port of Rotterdam', abbreviation: 'RTM' },
  { id: '2', name: 'Port of Amsterdam', abbreviation: 'AMS' },
  { id: '3', name: 'Rotterdam Europoort', abbreviation: null },
];

describe('matchPortByName', () => {
  it('returns match when exactly one port name includes the needle', () => {
    const result = matchPortByName(PORTS, 'Amsterdam');
    expect(result).toEqual({ status: 'match', port: PORTS[1] });
  });

  it('returns match by abbreviation (exact, case-insensitive)', () => {
    const result = matchPortByName(PORTS, 'rtm');
    expect(result).toEqual({ status: 'match', port: PORTS[0] });
  });

  it('returns none when no ports match', () => {
    const result = matchPortByName(PORTS, 'Hamburg');
    expect(result).toEqual({ status: 'none' });
  });

  it('returns multiple when more than one port matches', () => {
    // Both 'Port of Rotterdam' and 'Rotterdam Europoort' contain 'rotterdam'
    const result = matchPortByName(PORTS, 'rotterdam');
    expect(result).toEqual({ status: 'multiple' });
  });

  it('returns none for null aisPortName', () => {
    const result = matchPortByName(PORTS, null);
    expect(result).toEqual({ status: 'none' });
  });

  it('returns none for empty string', () => {
    const result = matchPortByName(PORTS, '');
    expect(result).toEqual({ status: 'none' });
  });
});
