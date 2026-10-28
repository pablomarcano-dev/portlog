import { useState } from 'react';
import { Alert, Button, Group, Select, Stack, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api/client';
import { portsApi, type PortRecord } from '../../../lib/api/master-data/ports';

async function allPorts() {
  const ports: PortRecord[] = [];
  let cursor: string | undefined;
  do {
    const page = await portsApi.list({ limit: 200, cursor });
    ports.push(...page.items);
    cursor = page.hasMore ? (page.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return ports;
}
export function BranchPortsPanel({ branchId }: { branchId: string }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['branch-port-associations', branchId], queryFn: allPorts });
  const choice = query.data?.find((p) => p.id === selected);
  async function change(port: PortRecord, remove: boolean) {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/master-data/branches/${branchId}/ports/${port.id}`, {
        method: remove ? 'DELETE' : 'POST',
        ...(!remove ? { body: JSON.stringify({ previousBranchId: port.branchId ?? null }) } : {}),
      });
      setSelected(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['branch-port-associations'] }),
        qc.invalidateQueries({ queryKey: ['ports'] }),
        qc.invalidateQueries({ queryKey: ['entity-picker'] }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change port assignment');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack gap="sm">
      <Text size="sm">
        Ports and terminals associated here use the same branch assignment shown in Master Data →
        Ports.
      </Text>
      {query.isPending && <Text>Loading ports…</Text>}
      {(query.isError || error) && (
        <Alert color="red">
          {error || 'Could not load ports'}
          <Button type="button" variant="subtle" onClick={() => void query.refetch()}>
            Reload ports
          </Button>
        </Alert>
      )}
      {query.data
        ?.filter((p) => p.branchId === branchId)
        .map((port) => (
          <Group key={port.id} justify="space-between">
            <Text>{port.name}</Text>
            <Button
              type="button"
              size="compact-xs"
              variant="subtle"
              color="orange"
              disabled={busy}
              onClick={() => void change(port, true)}
            >
              Remove association
            </Button>
          </Group>
        ))}
      <Select
        label="Associate port"
        placeholder="Select port or terminal"
        searchable
        clearable
        value={selected}
        onChange={setSelected}
        disabled={busy || query.isError}
        data={(query.data ?? [])
          .filter((p) => p.branchId !== branchId)
          .map((p) => ({
            value: p.id,
            label: `${p.name}${p.branch ? ` — ${p.branch.name}` : ' — Unassigned'}`,
          }))}
      />
      {choice?.branchId && (
        <Alert color="yellow">
          This moves {choice.name} from {choice.branch?.name ?? 'its current branch'} to this
          branch. Existing nominations are retained.
        </Alert>
      )}
      <Button
        type="button"
        disabled={!choice || busy}
        loading={busy}
        onClick={() => choice && void change(choice, false)}
      >
        {choice?.branchId ? 'Move port to this branch' : 'Associate port with this branch'}
      </Button>
    </Stack>
  );
}
