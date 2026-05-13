import { Table, Text, Skeleton, Stack, Center } from '@mantine/core';
import type { NominationListItem } from '@portlog/schemas';
import { NominationStatusBadge } from './NominationStatusBadge';

interface NominationTableProps {
  items: NominationListItem[];
  isLoading: boolean;
  onRowClick?: (id: string) => void;
}

const SKELETON_ROWS = 8;

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function NominationTable({ items, isLoading, onRowClick }: NominationTableProps) {
  if (isLoading) {
    return (
      <Stack gap="xs">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <Skeleton key={i} height={40} radius="sm" />
        ))}
      </Stack>
    );
  }

  if (items.length === 0) {
    return (
      <Center py="xl">
        <Text c="dimmed" size="sm">
          No nominations yet. Create one to get started.
        </Text>
      </Center>
    );
  }

  return (
    <Table striped highlightOnHover withTableBorder withColumnBorders={false}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>SN/OT</Table.Th>
          <Table.Th>Voyage Number</Table.Th>
          <Table.Th>Vessel</Table.Th>
          <Table.Th>Op Port</Table.Th>
          <Table.Th>Date Nominated</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Created At</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {items.map((item) => (
          <Table.Tr
            key={item.id}
            onClick={() => onRowClick?.(item.id)}
            style={{ cursor: onRowClick ? 'pointer' : undefined }}
          >
            <Table.Td>
              <Text size="sm" ff="monospace">
                {item.correlative}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" fw={500}>
                {item.voyageNumber}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{item.shipParticular.name}</Text>
              <Text size="xs" c="dimmed">
                {item.shipParticular.callSign}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">
                {item.opPort ? (item.opPort.abbreviation ?? item.opPort.name) : '—'}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{formatUtcDate(item.dateNominated)}</Text>
            </Table.Td>
            <Table.Td>
              <NominationStatusBadge status={item.status} />
            </Table.Td>
            <Table.Td>
              <Text size="sm">{formatUtcDate(item.createdAt)}</Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
