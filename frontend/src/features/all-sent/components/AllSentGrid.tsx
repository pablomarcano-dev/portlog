import { Table, Text, Anchor } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import type { AllSentRow, TrackerDocType } from '@portlog/schemas';
import { StatusIcon } from './StatusIcon';

const DOC_COLUMNS: TrackerDocType[] = ['SH_66A', 'SH_09A', 'SH_28A', 'SH_29A'];

const COL_LABELS: Record<TrackerDocType, string> = {
  SH_66A: 'SH-66A',
  SH_09A: 'SH-09A',
  SH_28A: 'SH-28A',
  SH_29A: 'SH-29A',
};

interface AllSentGridProps {
  rows: AllSentRow[];
}

export function AllSentGrid({ rows }: AllSentGridProps) {
  const navigate = useNavigate();
  if (rows.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No nominations found for the selected filters.
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={700}>
      <Table stickyHeader striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>SN</Table.Th>
            <Table.Th>Vessel</Table.Th>
            <Table.Th>Port</Table.Th>
            <Table.Th>ETA</Table.Th>
            {DOC_COLUMNS.map((type) => (
              <Table.Th key={type} ta="center">
                {COL_LABELS[type]}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.nominationId}>
              <Table.Td>
                <Anchor href={`/nominations/${row.nominationId}`} size="sm">
                  {row.correlative}
                </Anchor>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{row.vesselName ?? '—'}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">
                  {/* TODO: replace with canonical Sucursal model when decided */}
                  {row.portAbbreviation ?? row.portName ?? '—'}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">
                  {row.etaDate ? new Date(row.etaDate).toLocaleDateString() : '—'}
                </Text>
              </Table.Td>
              {DOC_COLUMNS.map((type) => (
                <Table.Td
                  key={type}
                  ta="center"
                  data-cy={`all-sent-cell-${row.nominationId}-${type}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    // Navigate to nomination detail where Documents tab lives
                    void navigate({ to: '/nominations/$id', params: { id: row.nominationId } });
                  }}
                >
                  <StatusIcon cell={row.cells[type]} />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
