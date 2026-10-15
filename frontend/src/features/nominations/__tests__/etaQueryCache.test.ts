import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { EtaRecordResponse } from '@portlog/schemas';
import { updateEtaQueryCache } from '../api/etaQueryCache';

const saved: EtaRecordResponse = {
  id: 'eta',
  pedrId: 'pedr',
  msgEta: null,
  etaNotify: '2026-10-16T23:00:00Z',
  etaNotifyOn: true,
  etpob: null,
  etpobOn: false,
  etb: null,
  etbOn: false,
  refMessage: null,
  captainMessage: 'Updated ETA',
  updatedAt: '2026-10-15T12:00:00Z',
};

describe('ETA save and message cache', () => {
  it('removes previously composed notices before reopening while preserving other nominations', async () => {
    const client = new QueryClient();
    for (const type of ['ETA_REPLY', 'ETA_TERMINAL', 'ETA_RECAP']) {
      client.setQueryData(['nomination', 'one', 'compose', type], { bodyText: 'Old ETA' });
    }
    const otherKey = ['nomination', 'two', 'compose', 'ETA_REPLY'];
    client.setQueryData(otherKey, { bodyText: 'Other vessel' });

    await updateEtaQueryCache(client, 'one', saved);

    expect(client.getQueriesData({ queryKey: ['nomination', 'one', 'compose'] })).toEqual([]);
    expect(client.getQueryData(['nomination', 'one', 'eta'])).toEqual(saved);
    expect(client.getQueryData(otherKey)).toEqual({ bodyText: 'Other vessel' });
    client.clear();
  });

  it('prevents an in-flight old compose response from restoring stale dates', async () => {
    const client = new QueryClient();
    const key = ['nomination', 'one', 'compose', 'ETA_REPLY'];
    let resolveOld!: (value: { bodyText: string }) => void;
    const pending = client
      .fetchQuery({
        queryKey: key,
        queryFn: () =>
          new Promise<{ bodyText: string }>((resolve) => {
            resolveOld = resolve;
          }),
      })
      .catch(() => undefined);

    await updateEtaQueryCache(client, 'one', saved);
    resolveOld({ bodyText: 'Outdated ETA' });
    await pending;

    expect(client.getQueryData(key)).toBeUndefined();
    expect(client.getQueryData(['nomination', 'one', 'eta'])).toEqual(saved);
    client.clear();
  });
});
