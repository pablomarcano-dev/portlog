import { useState } from 'react';
import { Alert, Button, Group, Select, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { NominationUpdateInput } from '@portlog/schemas';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import { agentsApi, type AgentRecord } from '../../../lib/api/master-data/agents';

type EditableNomination = {
  lastPortId: string | null;
  nextPortId: string | null;
  lastPort: { id: string; name: string } | null;
  nextPort: { id: string; name: string } | null;
  boardingClerk: string | null;
  branchId: string | null;
};

export function AgentNominationEditor({
  nomination,
  onSubmit,
  isSubmitting,
}: {
  nomination: EditableNomination;
  onSubmit: (values: NominationUpdateInput) => void;
  isSubmitting: boolean;
}) {
  const [lastPortId, setLastPortId] = useState(nomination.lastPortId);
  const [nextPortId, setNextPortId] = useState(nomination.nextPortId);
  const [lastPortSearch, setLastPortSearch] = useState('');
  const [nextPortSearch, setNextPortSearch] = useState('');
  const [boardingClerk, setBoardingClerk] = useState(nomination.boardingClerk ?? '');
  const agents = useQuery({
    queryKey: ['agents', 'boarding', nomination.branchId],
    queryFn: async () => {
      const items: AgentRecord[] = [];
      let cursor: string | undefined;
      do {
        const page = await agentsApi.list({
          branchId: nomination.branchId!,
          operationalRole: 'SHIPPING_AGENT',
          limit: 200,
          cursor,
        });
        items.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      return { items };
    },
    enabled: !!nomination.branchId,
  });
  const names = [
    ...new Set(
      [boardingClerk, ...(agents.data?.items ?? []).map((agent) => agent.name)].filter(Boolean),
    ),
  ];
  return (
    <Stack gap="sm" mb="md">
      <Alert color="blue">You can update Last Port, Next Port and Boarding for your branch.</Alert>
      {agents.isError && (
        <Alert color="red">Could not load boarding agents. Reload before changing Boarding.</Alert>
      )}
      <Group grow align="flex-start">
        <EntityPicker
          endpoint="/master-data/ports"
          extraParams={{ allPorts: 'true' }}
          label="Last Port"
          searchValue={lastPortSearch}
          onSearchChange={setLastPortSearch}
          clearable={false}
          value={lastPortId}
          selectedOption={
            nomination.lastPort
              ? { value: nomination.lastPort.id, label: nomination.lastPort.name }
              : null
          }
          onChange={(id) => setLastPortId(id)}
        />
        <EntityPicker
          endpoint="/master-data/ports"
          extraParams={{ allPorts: 'true' }}
          label="Next Port"
          searchValue={nextPortSearch}
          onSearchChange={setNextPortSearch}
          clearable={false}
          value={nextPortId}
          selectedOption={
            nomination.nextPort
              ? { value: nomination.nextPort.id, label: nomination.nextPort.name }
              : null
          }
          onChange={(id) => setNextPortId(id)}
        />
        <Select
          label="Boarding"
          data={names}
          value={boardingClerk || null}
          searchable
          clearable
          onChange={(name) => setBoardingClerk(name ?? '')}
          disabled={agents.isPending || agents.isError}
        />
      </Group>
      <Button
        loading={isSubmitting}
        onClick={() => {
          const patch: NominationUpdateInput = {};
          if (lastPortId && lastPortId !== nomination.lastPortId) patch.lastPortId = lastPortId;
          if (nextPortId && nextPortId !== nomination.nextPortId) patch.nextPortId = nextPortId;
          if (boardingClerk !== (nomination.boardingClerk ?? ''))
            patch.boardingClerk = boardingClerk;
          if (Object.keys(patch).length) onSubmit(patch);
        }}
      >
        Save permitted changes
      </Button>
    </Stack>
  );
}
