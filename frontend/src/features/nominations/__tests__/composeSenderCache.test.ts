import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { nominationComposeQueryKey } from '../api/nominationComposeQueryKey';
import { updateEtaQueryCache } from '../api/etaQueryCache';

describe('personal signature compose cache', () => {
  it('fetches the second authenticated author even while the first author remains fresh', async () => {
    const client = new QueryClient();
    const first = nominationComposeQueryKey('nomination', 'ETA_TERMINAL', 'agent-one');
    const second = nominationComposeQueryKey('nomination', 'ETA_TERMINAL', 'agent-two');
    const renderOne = vi.fn(async () => ({ bodyText: 'Best Regards, Agent One' }));
    const renderTwo = vi.fn(async () => ({ bodyText: 'Best Regards, Agent Two' }));

    await client.fetchQuery({ queryKey: first, queryFn: renderOne, staleTime: 10_000 });
    const composed = await client.fetchQuery({
      queryKey: second,
      queryFn: renderTwo,
      staleTime: 10_000,
    });

    expect(renderTwo).toHaveBeenCalledOnce();
    expect(composed.bodyText).toBe('Best Regards, Agent Two');
    expect(client.getQueryData(first)).toEqual({ bodyText: 'Best Regards, Agent One' });
    client.clear();
  });

  it('keeps an old in-flight author response away from the new author', async () => {
    const client = new QueryClient();
    const first = nominationComposeQueryKey('nomination', 'NOR', 'agent-one');
    const second = nominationComposeQueryKey('nomination', 'NOR', 'agent-two');
    let resolveOld!: (value: { bodyText: string }) => void;
    const pending = client.fetchQuery({
      queryKey: first,
      queryFn: () => new Promise<{ bodyText: string }>((resolve) => (resolveOld = resolve)),
    });
    await client.fetchQuery({
      queryKey: second,
      queryFn: async () => ({ bodyText: 'Best Regards, Agent Two' }),
    });
    resolveOld({ bodyText: 'Best Regards, Agent One' });
    await pending;

    expect(client.getQueryData(second)).toEqual({ bodyText: 'Best Regards, Agent Two' });
    client.clear();
  });

  it('still discards all authors compose drafts when ETA is updated', async () => {
    const client = new QueryClient();
    for (const sender of ['agent-one', 'agent-two']) {
      client.setQueryData(nominationComposeQueryKey('nomination', 'ETA_TERMINAL', sender), {
        bodyText: 'Old ETA and personal signature',
      });
    }
    await updateEtaQueryCache(client, 'nomination', {
      id: 'eta',
      pedrId: 'pedr',
      msgEta: null,
      etaNotify: null,
      etaNotifyOn: true,
      etpob: null,
      etpobOn: false,
      etb: null,
      etbOn: false,
      refMessage: null,
      captainMessage: null,
      updatedAt: '2026-11-24T12:00:00Z',
    });

    expect(client.getQueriesData({ queryKey: ['nomination', 'nomination', 'compose'] })).toEqual(
      [],
    );
    client.clear();
  });
});
