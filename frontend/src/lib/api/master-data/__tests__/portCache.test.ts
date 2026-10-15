import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidatePortQueries } from '../ports';

describe('port mutation cache invalidation', () => {
  it('expires old and new branch choices, port details and subject lookup after a reassignment', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const affectedKeys = [
      ['ports', 'list', 'old-branch'],
      ['ports', 'list', 'new-branch'],
      ['ports', 'saved-port'],
      ['entity-picker', '/master-data/ports', '', { branchId: 'old-branch' }, 200],
      ['entity-picker', '/master-data/ports', 'saved', { branchId: 'new-branch' }, 200],
      ['entity-picker', '/master-data/ports', '', undefined, 200],
      ['ports-for-vessel-fetch'],
    ];
    for (const key of affectedKeys) qc.setQueryData(key, { items: [] });
    const unrelatedKey = ['entity-picker', '/master-data/clients', ''];
    qc.setQueryData(unrelatedKey, { items: [] });

    await invalidatePortQueries(qc);

    for (const key of affectedKeys) expect(qc.getQueryState(key)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
    qc.clear();
  });
});
