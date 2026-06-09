import { Table, Text, Skeleton, Stack, Center } from '@mantine/core';
import type { NominationListItem } from '@portlog/schemas';
import { useColumnResize } from '../../../components/table/useColumnResize';
import { ResizableTh } from '../../../components/table/ResizableTh';
import { NominationStatusBadge } from './NominationStatusBadge';

interface NominationTableProps {
  items: NominationListItem[];
  isLoading: boolean;
  onRowClick?: (id: string) => void;
}

const SKELETON_ROWS = 8;

type ColKey = 'sn' | 'voyage' | 'vessel' | 'opPort' | 'date' | 'status' | 'createdAt';

const INITIAL_WIDTHS: Record<ColKey, number> = {
  sn: 80,
  voyage: 120,
  vessel: 160,
  opPort: 120,
  date: 110,
  status: 100,
  createdAt: 110,
};

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function NominationTable({ items, isLoading, onRowClick }: NominationTableProps) {
  const { colWidths, startResize } = useColumnResize<ColKey>(INITIAL_WIDTHS);

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
    <Table
      striped
      highlightOnHover
      withTableBorder
      withColumnBorders={false}
      style={{ tableLayout: 'fixed' }}
    >
      <Table.Thead>
        <Table.Tr>
          <ResizableTh width={colWidths.sn} onResize={(e) => startResize('sn', e)}>
            SN/OT
          </ResizableTh>
          <ResizableTh width={colWidths.voyage} onResize={(e) => startResize('voyage', e)}>
            Voyage Number
          </ResizableTh>
          <ResizableTh width={colWidths.vessel} onResize={(e) => startResize('vessel', e)}>
            Vessel
          </ResizableTh>
          <ResizableTh width={colWidths.opPort} onResize={(e) => startResize('opPort', e)}>
            Op Port
          </ResizableTh>
          <ResizableTh width={colWidths.date} onResize={(e) => startResize('date', e)}>
            Date Nominated
          </ResizableTh>
          <ResizableTh width={colWidths.status} onResize={(e) => startResize('status', e)}>
            Status
          </ResizableTh>
          <ResizableTh width={colWidths.createdAt} onResize={(e) => startResize('createdAt', e)}>
            Created At
          </ResizableTh>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {items.map((item) => (
          <Table.Tr
            key={item.id}
            onClick={() => onRowClick?.(item.id)}
            style={{ cursor: onRowClick ? 'pointer' : undefined }}
            data-cy="nomination-row"
          >
            <Table.Td style={{ width: colWidths.sn }}>
              <Text size="sm" ff="monospace">
                {item.correlative}
              </Text>
            </Table.Td>
            <Table.Td style={{ width: colWidths.voyage }}>
              <Text size="sm" fw={500}>
                {item.voyageNumber}
              </Text>
            </Table.Td>
            <Table.Td style={{ width: colWidths.vessel }}>
              <Text size="sm">{item.shipParticular.name}</Text>
              <Text size="xs" c="dimmed">
                {item.shipParticular.callSign}
              </Text>
            </Table.Td>
            <Table.Td style={{ width: colWidths.opPort }}>
              <Text size="sm">
                {item.opPort ? (item.opPort.abbreviation ?? item.opPort.name) : '—'}
              </Text>
            </Table.Td>
            <Table.Td style={{ width: colWidths.date }}>
              <Text size="sm">{formatUtcDate(item.dateNominated)}</Text>
            </Table.Td>
            <Table.Td style={{ width: colWidths.status }}>
              <NominationStatusBadge status={item.status} />
            </Table.Td>
            <Table.Td style={{ width: colWidths.createdAt }}>
              <Text size="sm">{formatUtcDate(item.createdAt)}</Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
