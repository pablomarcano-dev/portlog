import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { activityCatalogQueryOptions } from '../activities';
import { apiRequest } from '../../client';

vi.mock('../../client', () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);
const catalog = [
  { id: 'nor', label: 'Notice of Readiness Tendered' },
  { id: 'etc', label: 'E.T.C.' },
];
const clients: QueryClient[] = [];
function client() {
  const qc = new QueryClient();
  clients.push(qc);
  return qc;
}
afterEach(() => {
  clients.forEach((qc) => qc.clear());
  clients.length = 0;
  vi.resetAllMocks();
});

describe('shared SOF activity catalog', () => {
  it('deduplicates simultaneous consumers into one complete-catalog request', async () => {
    request.mockResolvedValue(catalog);
    const qc = client();
    const results = await Promise.all(
      Array.from({ length: 40 }, () => qc.fetchQuery(activityCatalogQueryOptions())),
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('/master-data/activities/search?q=', {
      signal: expect.any(AbortSignal),
    });
    expect(results.every((result) => result === results[0])).toBe(true);
    expect(results[0]).toEqual(catalog);
  });

  it('reuses a fresh catalog when reopening a SOF, then refreshes after ten minutes', async () => {
    request.mockResolvedValue(catalog);
    const qc = client();
    await qc.fetchQuery(activityCatalogQueryOptions());
    await qc.fetchQuery(activityCatalogQueryOptions());
    expect(request).toHaveBeenCalledTimes(1);
    qc.setQueryData(activityCatalogQueryOptions().queryKey, catalog, {
      updatedAt: Date.now() - 10 * 60_000 - 1,
    });
    await qc.fetchQuery(activityCatalogQueryOptions());
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('refreshes after existing activity mutation invalidation', async () => {
    request
      .mockResolvedValueOnce(catalog)
      .mockResolvedValueOnce([{ id: 'nor', label: 'Renamed NOR' }]);
    const qc = client();
    await qc.fetchQuery(activityCatalogQueryOptions());
    await qc.invalidateQueries({ queryKey: ['activities'] });
    const updated = await qc.fetchQuery(activityCatalogQueryOptions());
    expect(updated).toEqual([{ id: 'nor', label: 'Renamed NOR' }]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('keeps the cached catalog if a refresh fails and does not retry automatically', async () => {
    request.mockResolvedValueOnce(catalog).mockRejectedValueOnce(new Error('Too Many Requests'));
    const qc = client();
    await qc.fetchQuery(activityCatalogQueryOptions());
    await qc.invalidateQueries({ queryKey: ['activities'] });
    await expect(qc.fetchQuery(activityCatalogQueryOptions())).rejects.toThrow('Too Many Requests');
    expect(qc.getQueryData(activityCatalogQueryOptions().queryKey)).toEqual(catalog);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
