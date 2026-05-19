import { Anchor, Center, Skeleton, Table, Text } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import type { RadiusVessel } from '@portlog/schemas';

type SectionType = 'arribo' | 'fondeado' | 'zarpe';

interface VesselTableProps {
  title: string;
  vessels: RadiusVessel[];
  loading: boolean;
  section: SectionType;
}

function formatEpoch(epoch: number | null | undefined): string {
  if (!epoch) return '—';
  return new Date(epoch * 1_000).toLocaleString();
}

export function VesselTable({ title, vessels, loading, section }: VesselTableProps) {
  const navigate = useNavigate();

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
                {Array.from({ length: section === 'arribo' || section === 'zarpe' ? 9 : 7 }).map(
                  (__, j) => (
                    <Table.Td key={j}>
                      <Skeleton height={16} />
                    </Table.Td>
                  ),
                )}
              </Table.Tr>
            ))}

          {!loading && vessels.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={section === 'arribo' || section === 'zarpe' ? 9 : 7}>
                <Center py="sm">
                  <Text size="sm" c="dimmed">
                    Sin resultados
                  </Text>
                </Center>
              </Table.Td>
            </Table.Tr>
          )}

          {!loading &&
            vessels.map((v) => (
              <Table.Tr key={v.uuid}>
                <Table.Td>
                  <Anchor
                    size="sm"
                    onClick={() => void navigate({ to: '/vessels/$imo', params: { imo: v.imo } })}
                    style={{ cursor: 'pointer' }}
                  >
                    {v.name}
                  </Anchor>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{v.imo || '—'}</Text>
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
            ))}
        </Table.Tbody>
      </Table>
    </>
  );
}
