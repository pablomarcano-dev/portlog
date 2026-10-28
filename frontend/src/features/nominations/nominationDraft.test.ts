import { describe, it, expect } from 'vitest';
import {
  readNominationDraft,
  saveNominationDraft,
  clearNominationDraft,
  draftKey,
} from './nominationDraft';
function storage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}
describe('local pending nomination', () => {
  it('round-trips incomplete parcel and client rows and date values without creating a nomination', () => {
    const s = storage();
    saveNominationDraft(s, 'user-a', {
      master: 'Captain Example',
      dateNominated: new Date('2026-10-28T12:00:00Z'),
      parcels: [{ product: '', quantity: 0, unit: '', operation: '' }],
      nominationClients: [{ type: 'Charterer', name: '', sortOrder: 0 }],
    });
    const restored = readNominationDraft(s, 'user-a');
    expect(restored?.master).toBe('Captain Example');
    expect(restored?.parcels?.[0]?.unit).toBe('');
    expect(restored?.dateNominated).toEqual(new Date('2026-10-28T12:00:00Z'));
  });
  it('isolates accounts and only clears the requested user draft', () => {
    const s = storage();
    saveNominationDraft(s, 'a', { master: 'A' });
    saveNominationDraft(s, 'b', { master: 'B' });
    clearNominationDraft(s, 'a');
    expect(readNominationDraft(s, 'a')).toBeNull();
    expect(readNominationDraft(s, 'b')?.master).toBe('B');
  });
  it('rejects wrong versions, malformed arrays, invalid dates and wrong-owner data', () => {
    const s = storage();
    for (const data of [
      { version: 2, owner: 'a', values: {} },
      { version: 1, owner: 'b', values: {} },
      { version: 1, owner: 'a', values: { parcels: 'oops' } },
      { version: 1, owner: 'a', values: { etaDate: 'not a date' } },
    ]) {
      s.setItem(draftKey('a'), JSON.stringify(data));
      expect(readNominationDraft(s, 'a')).toBeNull();
    }
  });
  it('surfaces storage failures instead of pretending progress was saved', () => {
    expect(() =>
      saveNominationDraft(
        {
          setItem() {
            throw Error('Storage full');
          },
        },
        'a',
        {},
      ),
    ).toThrow('Storage full');
  });
});
