import { useRef, useState } from 'react';
import { Box, Button, Group, Loader, Table, Text, TextInput, Title } from '@mantine/core';
import type { NominationClient } from '@portlog/schemas';
import {
  useNominationClients,
  useAddClient,
  useUpdateClient,
  useRemoveClient,
} from '../hooks/useNominationClients';

interface ClientRowProps {
  client: NominationClient;
  nominationId: string;
  isUpdating: boolean;
  isRemoving: boolean;
  onUpdate: (
    clientId: string,
    field: keyof Omit<NominationClient, 'id' | 'sortOrder'>,
    value: string,
  ) => void;
  onRemove: (clientId: string) => void;
}

function ClientRow({ client, isUpdating, isRemoving, onUpdate, onRemove }: ClientRowProps) {
  const clientId = client.id ?? '';
  const isBusy = isUpdating || isRemoving;

  return (
    <Table.Tr>
      <Table.Td>
        <TextInput
          size="xs"
          defaultValue={client.type}
          disabled={isBusy}
          onBlur={(e) => {
            const val = e.currentTarget.value.trim();
            if (val !== client.type) {
              onUpdate(clientId, 'type', val);
            }
          }}
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          size="xs"
          defaultValue={client.name}
          disabled={isBusy}
          onBlur={(e) => {
            const val = e.currentTarget.value.trim();
            if (val !== client.name) {
              onUpdate(clientId, 'name', val);
            }
          }}
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          size="xs"
          defaultValue={client.voyageRef ?? ''}
          disabled={isBusy}
          onBlur={(e) => {
            const val = e.currentTarget.value.trim();
            if (val !== (client.voyageRef ?? '')) {
              onUpdate(clientId, 'voyageRef', val);
            }
          }}
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          size="xs"
          defaultValue={client.referenceNo ?? ''}
          disabled={isBusy}
          onBlur={(e) => {
            const val = e.currentTarget.value.trim();
            if (val !== (client.referenceNo ?? '')) {
              onUpdate(clientId, 'referenceNo', val);
            }
          }}
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          size="xs"
          defaultValue={client.proforma ?? ''}
          disabled={isBusy}
          onBlur={(e) => {
            const val = e.currentTarget.value.trim();
            if (val !== (client.proforma ?? '')) {
              onUpdate(clientId, 'proforma', val);
            }
          }}
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          size="xs"
          defaultValue={client.broker ?? ''}
          disabled={isBusy}
          onBlur={(e) => {
            const val = e.currentTarget.value.trim();
            if (val !== (client.broker ?? '')) {
              onUpdate(clientId, 'broker', val);
            }
          }}
        />
      </Table.Td>
      <Table.Td>
        <Button
          size="compact-xs"
          color="red"
          variant="subtle"
          loading={isRemoving}
          disabled={isBusy}
          onClick={() => onRemove(clientId)}
          aria-label="Remove client row"
        >
          x
        </Button>
      </Table.Td>
    </Table.Tr>
  );
}

interface ClientsSectionProps {
  nominationId: string;
}

export function ClientsSection({ nominationId }: ClientsSectionProps) {
  const { data: clients, isLoading } = useNominationClients(nominationId);
  const addClient = useAddClient(nominationId);
  const updateClient = useUpdateClient(nominationId);
  const removeClient = useRemoveClient(nominationId);

  const removingId = useRef<string | null>(null);
  const updatingId = useRef<string | null>(null);
  const [, setTick] = useState(0);

  function handleUpdate(
    clientId: string,
    field: keyof Omit<NominationClient, 'id' | 'sortOrder'>,
    value: string,
  ) {
    updatingId.current = clientId;
    setTick((t) => t + 1);
    updateClient.mutate(
      { clientId, data: { [field]: value } },
      {
        onSettled: () => {
          updatingId.current = null;
          setTick((t) => t + 1);
        },
      },
    );
  }

  function handleRemove(clientId: string) {
    removingId.current = clientId;
    setTick((t) => t + 1);
    removeClient.mutate(clientId, {
      onSettled: () => {
        removingId.current = null;
        setTick((t) => t + 1);
      },
    });
  }

  function handleAddRow() {
    addClient.mutate({ type: '', name: '', sortOrder: clients?.length ?? 0 });
  }

  return (
    <Box>
      <Group justify="space-between" mb="xs">
        <Title order={5}>Client List</Title>
        {isLoading && <Loader size="xs" />}
      </Group>

      {!isLoading && (clients == null || clients.length === 0) && (
        <Text size="sm" c="dimmed" mb="xs">
          No clients added yet.
        </Text>
      )}

      {clients != null && clients.length > 0 && (
        <Table striped withTableBorder withColumnBorders mb="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Voy.</Table.Th>
              <Table.Th>Ref. No.</Table.Th>
              <Table.Th>Proforma</Table.Th>
              <Table.Th>Broker</Table.Th>
              <Table.Th style={{ width: 40 }} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {clients.map((client) => {
              const clientId = client.id ?? '';
              return (
                <ClientRow
                  key={clientId}
                  client={client}
                  nominationId={nominationId}
                  isUpdating={updatingId.current === clientId}
                  isRemoving={removingId.current === clientId}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                />
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Button variant="outline" size="xs" loading={addClient.isPending} onClick={handleAddRow}>
        + Add row
      </Button>
    </Box>
  );
}
