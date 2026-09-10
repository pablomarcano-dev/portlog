import { describe, expect, it } from 'vitest';
import { normalizeNominationClientDirectoryLinks } from '@portlog/schemas';
describe('role-independent nomination selection', () => {
  it.each(['Charterer', 'Shipper', 'Commercial Operator', 'Receivers'])(
    'retains the chosen Client when changing to %s',
    (type) => {
      const existing = { type: 'Charterer', clientId: 'cms2268fg00cspz6hc0dz4yac', ownerId: null };
      expect({
        ...existing,
        ...normalizeNominationClientDirectoryLinks({ type }, existing),
      }).toEqual({ ...existing, type });
    },
  );
});
