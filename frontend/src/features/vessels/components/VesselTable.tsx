import { useState } from 'react';
import {
  ActionIcon,
  Anchor,
  Center,
  Checkbox,
  Collapse,
  Group,
  Loader,
  Menu,
  Skeleton,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { EnrichedVessel } from '../lib/types';
import { useOwnershipForImo } from '../api/useVesselOwnership';
import { contactsApi } from '../../../lib/api/master-data/contacts';
import { formatDateTime } from '../../../lib/format/datetime';
import { useColumnResize } from '../../../components/table/useColumnResize';
import { ResizableTh } from '../../../components/table/ResizableTh';

type SectionType = 'arribo' | 'fondeado' | 'zarpe';

type ColKey =
  | 'vessel'
  | 'imo'
  | 'type'
  | 'flag'
  | 'dist'
  | 'speed'
  | 'destination'
  | 'eta'
  | 'status'
  | 'lastPosition'
  | 'course';

const INITIAL_WIDTHS: Record<ColKey, number> = {
  vessel: 160,
  imo: 90,
  type: 140,
  flag: 60,
  dist: 80,
  speed: 80,
  destination: 140,
  eta: 160,
  status: 140,
  lastPosition: 160,
  course: 70,
};

interface VesselTableProps {
  title: string;
  vessels: EnrichedVessel[];
  loading: boolean;
  section: SectionType;
  selectedImos?: Set<string>;
  onToggle?: (imo: string) => void;
  onSaveToDb?: (vessel: EnrichedVessel) => void;
  onAddToFleet?: (vessel: EnrichedVessel) => void;
}

function formatEpoch(epoch: number | null | undefined): string {
  if (!epoch) return '—';
  return formatDateTime(epoch * 1_000);
}

// Fetches its own ownership data — only mounts when a row is expanded,
// so the Datalastic call fires on demand rather than for every row upfront.
// Returns content only (no Table.Tr) — the caller wraps this in Tr > Td > Collapse.
function OwnershipRowContent({ vessel }: { vessel: EnrichedVessel }) {
  const { data: ownership, isLoading } = useOwnershipForImo(vessel.imo);
  const qc = useQueryClient();
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const addContact = useMutation({
    mutationFn: (name: string) => contactsApi.create({ name }),
    onSuccess: (_, name) => {
      void qc.invalidateQueries({ queryKey: ['contacts'] });
      setSaved((prev) => new Set(prev).add(name));
      notifications.show({ color: 'green', message: `"${name}" added to Contacts.` });
    },
    onError: (_, name) => {
      notifications.show({ color: 'red', message: `Failed to add "${name}" as contact.` });
    },
  });

  const fields: { label: string; value: string | null | undefined }[] = [
    { label: 'Beneficial Owner', value: ownership?.beneficial_owner },
    { label: 'Operator', value: ownership?.operator },
    { label: 'Technical Manager', value: ownership?.technical_manager },
    { label: 'Commercial Manager', value: ownership?.commercial_manager },
  ];

  if (isLoading) return <Loader size="xs" />;

  return (
    <Group gap="xl" wrap="nowrap">
      {fields.map(({ label, value }) => (
        <Group key={label} gap={4} align="center" wrap="nowrap">
          <Text size="xs" c="dimmed">
            <strong>{label}:</strong> {value || '—'}
          </Text>
          {value && (
            <Tooltip label={saved.has(value) ? 'Added to Contacts' : 'Add as contact'} withArrow>
              <ActionIcon
                size="xs"
                variant="subtle"
                color={saved.has(value) ? 'green' : 'gray'}
                disabled={saved.has(value) || addContact.isPending}
                onClick={() => addContact.mutate(value)}
              >
                {saved.has(value) ? '✓' : '+'}
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ))}
    </Group>
  );
}

export function VesselTable({
  title,
  vessels,
  loading,
  section,
  selectedImos,
  onToggle,
  onSaveToDb,
  onAddToFleet,
}: VesselTableProps) {
  const navigate = useNavigate();
  const [expandedImos, setExpandedImos] = useState<Set<string>>(new Set());
  const { colWidths, startResize } = useColumnResize<ColKey>(INITIAL_WIDTHS);

  function toggleExpand(imo: string) {
    setExpandedImos((prev) => {
      const next = new Set(prev);
      if (next.has(imo)) next.delete(imo);
      else next.add(imo);
      return next;
    });
  }

  const hasActions = !!(onSaveToDb ?? onAddToFleet);
  const hasCheckbox = !!onToggle;
  const extraCols = section === 'arribo' || section === 'zarpe' ? 4 : 2;
  // base cols: checkbox(opt) + name + imo + type + flag + dist + section-extra + actions(opt)
  const totalCols = (hasCheckbox ? 1 : 0) + 5 + extraCols + (hasActions ? 1 : 0);

  return (
    <>
      <Text fw={600} size="md" mb="xs">
        {title}{' '}
        {!loading && (
          <Text component="span" size="sm" c="dimmed" fw={400}>
            ({vessels.length})
          </Text>
        )}
      </Text>

      <Table striped withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
        <Table.Thead>
          <Table.Tr>
            {hasCheckbox && <Table.Th style={{ width: 36 }} />}
            <ResizableTh width={colWidths.vessel} onResize={(e) => startResize('vessel', e)}>
              Vessel
            </ResizableTh>
            <ResizableTh width={colWidths.imo} onResize={(e) => startResize('imo', e)}>
              IMO
            </ResizableTh>
            <ResizableTh width={colWidths.type} onResize={(e) => startResize('type', e)}>
              Type
            </ResizableTh>
            <ResizableTh width={colWidths.flag} onResize={(e) => startResize('flag', e)}>
              Flag
            </ResizableTh>
            <ResizableTh width={colWidths.dist} onResize={(e) => startResize('dist', e)}>
              Dist (NM)
            </ResizableTh>
            {section === 'arribo' && (
              <>
                <ResizableTh width={colWidths.speed} onResize={(e) => startResize('speed', e)}>
                  Speed (kn)
                </ResizableTh>
                <ResizableTh
                  width={colWidths.destination}
                  onResize={(e) => startResize('destination', e)}
                >
                  Destination
                </ResizableTh>
                <ResizableTh width={colWidths.eta} onResize={(e) => startResize('eta', e)}>
                  ETA
                </ResizableTh>
                <ResizableTh width={colWidths.status} onResize={(e) => startResize('status', e)}>
                  Status
                </ResizableTh>
              </>
            )}
            {section === 'fondeado' && (
              <>
                <ResizableTh width={colWidths.status} onResize={(e) => startResize('status', e)}>
                  Status
                </ResizableTh>
                <ResizableTh
                  width={colWidths.lastPosition}
                  onResize={(e) => startResize('lastPosition', e)}
                >
                  Last Position
                </ResizableTh>
              </>
            )}
            {section === 'zarpe' && (
              <>
                <ResizableTh width={colWidths.speed} onResize={(e) => startResize('speed', e)}>
                  Speed (kn)
                </ResizableTh>
                <ResizableTh width={colWidths.course} onResize={(e) => startResize('course', e)}>
                  Course
                </ResizableTh>
                <ResizableTh
                  width={colWidths.destination}
                  onResize={(e) => startResize('destination', e)}
                >
                  Destination
                </ResizableTh>
                <ResizableTh width={colWidths.status} onResize={(e) => startResize('status', e)}>
                  Status
                </ResizableTh>
              </>
            )}
            {hasActions && <Table.Th style={{ width: 44 }} />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <Table.Tr key={i}>
                {Array.from({ length: totalCols }).map((__, j) => (
                  <Table.Td key={j}>
                    <Skeleton height={16} />
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}

          {!loading && vessels.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={totalCols}>
                <Center py="sm">
                  <Text size="sm" c="dimmed">
                    Sin resultados
                  </Text>
                </Center>
              </Table.Td>
            </Table.Tr>
          )}

          {!loading &&
            vessels.map((v) => {
              const isExpanded = expandedImos.has(v.imo);
              const isSelected = selectedImos?.has(v.imo) ?? false;
              return (
                <>
                  <Table.Tr key={v.uuid}>
                    {hasCheckbox && (
                      <Table.Td>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => onToggle?.(v.imo)}
                          size="sm"
                        />
                      </Table.Td>
                    )}
                    <Table.Td style={{ width: colWidths.vessel }}>
                      <Anchor
                        size="sm"
                        onClick={() => toggleExpand(v.imo)}
                        style={{ cursor: 'pointer' }}
                      >
                        {v.name}
                      </Anchor>
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.imo }}>
                      <Anchor
                        size="sm"
                        onClick={() =>
                          void navigate({ to: '/vessels/$imo', params: { imo: v.imo } })
                        }
                        style={{ cursor: 'pointer' }}
                      >
                        {v.imo || '—'}
                      </Anchor>
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.type }}>
                      <Text size="sm">{v.type_specific || v.type || '—'}</Text>
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.flag }}>
                      <Text size="sm">{v.country_iso || '—'}</Text>
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.dist }}>
                      <Text size="sm">{v.distance.toFixed(1)}</Text>
                    </Table.Td>

                    {section === 'arribo' && (
                      <>
                        <Table.Td style={{ width: colWidths.speed }}>
                          <Text size="sm">{v.speed.toFixed(1)}</Text>
                        </Table.Td>
                        <Table.Td style={{ width: colWidths.destination }}>
                          <Text size="sm">{v.destination || '—'}</Text>
                        </Table.Td>
                        <Table.Td style={{ width: colWidths.eta }}>
                          <Text size="sm">{formatEpoch(v.eta_epoch)}</Text>
                        </Table.Td>
                        <Table.Td style={{ width: colWidths.status }}>
                          <Text size="sm">{v.navigation_status || '—'}</Text>
                        </Table.Td>
                      </>
                    )}

                    {section === 'fondeado' && (
                      <>
                        <Table.Td style={{ width: colWidths.status }}>
                          <Text size="sm">{v.navigation_status || '—'}</Text>
                        </Table.Td>
                        <Table.Td style={{ width: colWidths.lastPosition }}>
                          <Text size="sm">{formatEpoch(v.last_position_epoch)}</Text>
                        </Table.Td>
                      </>
                    )}

                    {section === 'zarpe' && (
                      <>
                        <Table.Td style={{ width: colWidths.speed }}>
                          <Text size="sm">{v.speed.toFixed(1)}</Text>
                        </Table.Td>
                        <Table.Td style={{ width: colWidths.course }}>
                          <Text size="sm">{v.course.toFixed(0)}°</Text>
                        </Table.Td>
                        <Table.Td style={{ width: colWidths.destination }}>
                          <Text size="sm">{v.destination || '—'}</Text>
                        </Table.Td>
                        <Table.Td style={{ width: colWidths.status }}>
                          <Text size="sm">{v.navigation_status || '—'}</Text>
                        </Table.Td>
                      </>
                    )}

                    {hasActions && (
                      <Table.Td>
                        <Menu shadow="sm" width={160} position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon variant="subtle" size="sm" aria-label="Row actions">
                              ⋯
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            {onAddToFleet && (
                              <Menu.Item onClick={() => onAddToFleet(v)}>Add to Fleet</Menu.Item>
                            )}
                            {onSaveToDb && (
                              <Menu.Item onClick={() => onSaveToDb(v)}>Save to Ships</Menu.Item>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    )}
                  </Table.Tr>
                  {isExpanded && (
                    <Table.Tr key={`${v.uuid}-ownership`}>
                      <Table.Td
                        colSpan={totalCols}
                        px="md"
                        py="xs"
                        style={{ background: 'var(--mantine-color-gray-0)' }}
                      >
                        <Collapse in={isExpanded}>
                          <OwnershipRowContent vessel={v} />
                        </Collapse>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </>
              );
            })}
        </Table.Tbody>
      </Table>
    </>
  );
}
