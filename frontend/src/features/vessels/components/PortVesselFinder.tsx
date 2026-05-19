import { useState } from 'react';
import {
  Center,
  Container,
  Group,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type { PortDetail, RadiusVessel } from '@portlog/schemas';
import { PortAutocomplete } from './PortAutocomplete';
import { VesselTable } from './VesselTable';
import { FleetPanel } from './FleetPanel';
import { useVesselsInRadius } from '../api/useVesselsInRadius';
import { categorizeVessel, isRelevantVessel } from '../lib/categorize';

const DEFAULT_RADIUS = 25; // nautical miles

type StageFilter = 'all' | 'arribo' | 'fondeado' | 'zarpe';

export function PortVesselFinder() {
  const [selectedPort, setSelectedPort] = useState<PortDetail | null>(null);
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');

  const { vessels, isLoading } = useVesselsInRadius(
    selectedPort?.lat ?? null,
    selectedPort?.lon ?? null,
    DEFAULT_RADIUS,
  );

  const relevant = vessels.filter(isRelevantVessel);

  const categorized = relevant.reduce<{
    arribo: RadiusVessel[];
    fondeado: RadiusVessel[];
    zarpe: RadiusVessel[];
  }>(
    (acc, v) => {
      if (!selectedPort) return acc;
      const cat = categorizeVessel(v, {
        portName: selectedPort.port_name,
        portUnlocode: selectedPort.unlocode,
      });
      acc[cat].push(v);
      return acc;
    },
    { arribo: [], fondeado: [], zarpe: [] },
  );

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <Title order={2}>Port Vessel Finder</Title>

        <PortAutocomplete onPortSelect={setSelectedPort} selectedPort={selectedPort} />

        {!selectedPort && (
          <Center py="xl">
            <Text c="dimmed" size="sm">
              Search and select a port to see vessels in its vicinity.
            </Text>
          </Center>
        )}

        {selectedPort && (
          <>
            <Group justify="space-between" align="center">
              <Text size="sm" c="dimmed">
                Showing vessels within {DEFAULT_RADIUS} NM of {selectedPort.port_name}
              </Text>
              <SegmentedControl
                value={stageFilter}
                onChange={(v) => setStageFilter(v as StageFilter)}
                data={[
                  { value: 'all', label: 'All' },
                  { value: 'arribo', label: `Arribo (${categorized.arribo.length})` },
                  { value: 'fondeado', label: `Fondeado (${categorized.fondeado.length})` },
                  { value: 'zarpe', label: `Zarpe (${categorized.zarpe.length})` },
                ]}
                size="sm"
              />
            </Group>

            {isLoading && <Skeleton height={200} />}

            {!isLoading && (
              <Stack gap="xl">
                {(stageFilter === 'all' || stageFilter === 'arribo') && (
                  <VesselTable
                    title="Arribo"
                    vessels={categorized.arribo}
                    loading={false}
                    section="arribo"
                  />
                )}
                {(stageFilter === 'all' || stageFilter === 'fondeado') && (
                  <VesselTable
                    title="Fondeado"
                    vessels={categorized.fondeado}
                    loading={false}
                    section="fondeado"
                  />
                )}
                {(stageFilter === 'all' || stageFilter === 'zarpe') && (
                  <VesselTable
                    title="Zarpe"
                    vessels={categorized.zarpe}
                    loading={false}
                    section="zarpe"
                  />
                )}
              </Stack>
            )}

            <FleetPanel unlocode={selectedPort.unlocode} />
          </>
        )}
      </Stack>
    </Container>
  );
}
