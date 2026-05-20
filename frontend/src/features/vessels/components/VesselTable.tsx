import { useState } from 'react';
import { Anchor, Center, Checkbox, Collapse, Skeleton, Table, Text } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import type { VesselOwnership } from '@portlog/schemas';
import type { EnrichedVessel } from '../lib/types';

type SectionType = 'arribo' | 'fondeado' | 'zarpe';

interface VesselTableProps {
  title: string;
  vessels: EnrichedVessel[];
  loading: boolean;
  section: SectionType;
  ownershipMap?: Map<string, VesselOwnership>;
  selectedImos?: Set<string>;
  onToggle?: (imo: string) => void;
}

function formatEpoch(epoch: number | null | undefined): string {
  if (!epoch) return '—';
  return new Date(epoch * 1_000).toLocaleString();
}

function OwnershipRow({
  vessel,
  colSpan,
  ownershipMap,
}: {
  vessel: EnrichedVessel;
  colSpan: number;
  ownershipMap: Map<string, VesselOwnership> | undefined;
}) {
  const ownership = ownershipMap?.get(vessel.imo);
  const beneficialOwner = ownership?.beneficial_owner ?? vessel.beneficial_owner ?? '—';
  const operator = ownership?.operator ?? vessel.operator_name ?? '—';
  const technicalManager = ownership?.technical_manager ?? vessel.technical_manager ?? '—';
  const commercialManager = ownership?.commercial_manager ?? vessel.commercial_manager ?? '—';

  return (
    <Table.Tr style={{ background: 'var(--mantine-color-gray-0)' }}>
      <Table.Td colSpan={colSpan} px="md" py="xs">
        <Text size="xs" c="dimmed">
          <strong>Beneficial Owner:</strong> {beneficialOwner || '—'} &nbsp;|&nbsp;
          <strong>Operator:</strong> {operator || '—'} &nbsp;|&nbsp;
          <strong>Technical Manager:</strong> {technicalManager || '—'} &nbsp;|&nbsp;
          <strong>Commercial Manager:</strong> {commercialManager || '—'}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

export function VesselTable({
  title,
  vessels,
  loading,
  section,
  ownershipMap,
  selectedImos,
  onToggle,
}: VesselTableProps) {
  const navigate = useNavigate();
  const [expandedImos, setExpandedImos] = useState<Set<string>>(new Set());

  function toggleExpand(imo: string) {
    setExpandedImos((prev) => {
      const next = new Set(prev);
      if (next.has(imo)) next.delete(imo);
      else next.add(imo);
      return next;
    });
  }

  const hasCheckbox = !!onToggle;
  const extraCols = section === 'arribo' || section === 'zarpe' ? 4 : 2;
  // base cols: checkbox(opt) + name + imo + type + flag + dist + section-extra
  const totalCols = (hasCheckbox ? 1 : 0) + 5 + extraCols;

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

      <Table striped withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            {hasCheckbox && <Table.Th style={{ width: 36 }} />}
            <Table.Th>Vessel</Table.Th>
            <Table.Th>IMO</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Flag</Table.Th>
            <Table.Th>Dist (NM)</Table.Th>
            {section === 'arribo' && (
              <>
                <Table.Th>Speed (kn)</Table.Th>
                <Table.Th>Destination</Table.Th>
                <Table.Th>ETA</Table.Th>
                <Table.Th>Status</Table.Th>
              </>
            )}
            {section === 'fondeado' && (
              <>
                <Table.Th>Status</Table.Th>
                <Table.Th>Last Position</Table.Th>
              </>
            )}
            {section === 'zarpe' && (
              <>
                <Table.Th>Speed (kn)</Table.Th>
                <Table.Th>Course</Table.Th>
                <Table.Th>Destination</Table.Th>
                <Table.Th>Status</Table.Th>
              </>
            )}
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
                    <Table.Td>
                      <Anchor
                        size="sm"
                        onClick={() => toggleExpand(v.imo)}
                        style={{ cursor: 'pointer' }}
                      >
                        {v.name}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>
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
                    <Table.Td>
                      <Text size="sm">{v.type_specific || v.type || '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{v.country_iso || '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{v.distance.toFixed(1)}</Text>
                    </Table.Td>

                    {section === 'arribo' && (
                      <>
                        <Table.Td>
                          <Text size="sm">{v.speed.toFixed(1)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{v.destination || '—'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatEpoch(v.eta_epoch)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{v.navigation_status || '—'}</Text>
                        </Table.Td>
                      </>
                    )}

                    {section === 'fondeado' && (
                      <>
                        <Table.Td>
                          <Text size="sm">{v.navigation_status || '—'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatEpoch(v.last_position_epoch)}</Text>
                        </Table.Td>
                      </>
                    )}

                    {section === 'zarpe' && (
                      <>
                        <Table.Td>
                          <Text size="sm">{v.speed.toFixed(1)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{v.course.toFixed(0)}°</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{v.destination || '—'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{v.navigation_status || '—'}</Text>
                        </Table.Td>
                      </>
                    )}
                  </Table.Tr>
                  {isExpanded && (
                    <Table.Tr key={`${v.uuid}-ownership`}>
                      <Table.Td colSpan={totalCols} p={0}>
                        <Collapse in={isExpanded}>
                          <OwnershipRow
                            vessel={v}
                            colSpan={totalCols}
                            ownershipMap={ownershipMap}
                          />
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
