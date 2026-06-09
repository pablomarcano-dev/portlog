import { Table, Text, Anchor } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import type { AllSentRow, TrackerDocType } from '@portlog/schemas';
import { useColumnResize } from '../../../components/table/useColumnResize';
import { ResizableTh } from '../../../components/table/ResizableTh';
import { StatusIcon } from './StatusIcon';

const DOC_COLUMNS: TrackerDocType[] = ['SH_66A', 'SH_09A', 'SH_28A', 'SH_29A'];

const COL_LABELS: Record<TrackerDocType, string> = {
  SH_66A: 'SH-66A',
  SH_09A: 'SH-09A',
  SH_28A: 'SH-28A',
  SH_29A: 'SH-29A',
};

type ColKey = 'sn' | 'vessel' | 'port' | 'eta' | 'SH_66A' | 'SH_09A' | 'SH_28A' | 'SH_29A';

const INITIAL_WIDTHS: Record<ColKey, number> = {
  sn: 90,
  vessel: 160,
  port: 120,
  eta: 100,
  SH_66A: 80,
  SH_09A: 80,
  SH_28A: 80,
  SH_29A: 80,
};

interface AllSentGridProps {
  rows: AllSentRow[];
}

export function AllSentGrid({ rows }: AllSentGridProps) {
  const navigate = useNavigate();
  const { colWidths, startResize } = useColumnResize<ColKey>(INITIAL_WIDTHS);

  if (rows.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No nominations found for the selected filters.
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={700}>
      <Table
        stickyHeader
        striped
        highlightOnHover
        withTableBorder
        withColumnBorders
        style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}
      >
        <Table.Thead>
          <Table.Tr>
            <ResizableTh width={colWidths.sn} onResize={(e) => startResize('sn', e)}>
              SN
            </ResizableTh>
            <ResizableTh width={colWidths.vessel} onResize={(e) => startResize('vessel', e)}>
              Vessel
            </ResizableTh>
            <ResizableTh width={colWidths.port} onResize={(e) => startResize('port', e)}>
              Port
            </ResizableTh>
            <ResizableTh width={colWidths.eta} onResize={(e) => startResize('eta', e)}>
              ETA
            </ResizableTh>
            {DOC_COLUMNS.map((type) => (
              <ResizableTh
                key={type}
                width={colWidths[type as ColKey]}
                onResize={(e) => startResize(type as ColKey, e)}
                style={{ textAlign: 'center' }}
              >
                {COL_LABELS[type]}
              </ResizableTh>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.nominationId}>
              <Table.Td style={{ width: colWidths.sn }}>
                <Anchor href={`/nominations/${row.nominationId}`} size="sm">
                  {row.correlative}
                </Anchor>
              </Table.Td>
              <Table.Td style={{ width: colWidths.vessel }}>
                <Text size="sm">{row.vesselName ?? '—'}</Text>
              </Table.Td>
              <Table.Td style={{ width: colWidths.port }}>
                <Text size="sm">
                  {/* TODO: replace with canonical Sucursal model when decided */}
                  {row.portAbbreviation ?? row.portName ?? '—'}
                </Text>
              </Table.Td>
              <Table.Td style={{ width: colWidths.eta }}>
                <Text size="sm">
                  {row.etaDate ? new Date(row.etaDate).toLocaleDateString() : '—'}
                </Text>
              </Table.Td>
              {DOC_COLUMNS.map((type) => (
                <Table.Td
                  key={type}
                  ta="center"
                  data-cy={`all-sent-cell-${row.nominationId}-${type}`}
                  style={{ cursor: 'pointer', width: colWidths[type as ColKey] }}
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
