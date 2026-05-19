import { Alert, Box, Button, Card, Group, Loader, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';
import type { NominationCreateInput } from '@portlog/schemas';
import type { AisVessel } from '@portlog/schemas';
import { ApiError } from '../../../lib/api/errors';
import { apiRequest } from '../../../lib/api/client';
import { useAisLookup } from '../hooks/useAisLookup';
import { matchPortByName } from '../lib/match-port-by-name';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PortItem {
  id: string;
  name: string;
  abbreviation: string | null;
}

interface PortListResponse {
  items: PortItem[];
}

interface AisSuggestionPanelProps {
  imo: string;
  form: UseFormReturn<NominationCreateInput>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLatLon(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}

function formatUtc(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toUTCString();
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Port apply logic
// ---------------------------------------------------------------------------

type PortField = 'lastPortId' | 'nextPortId';

// ---------------------------------------------------------------------------
// Sub-component: PortSuggestionRow
// ---------------------------------------------------------------------------

interface PortSuggestionRowProps {
  label: string;
  aisPortName: string | null | undefined;
  ports: PortItem[];
  hint: string | null;
  onApply: () => void;
}

function PortSuggestionRow({ label, aisPortName, ports, hint, onApply }: PortSuggestionRowProps) {
  if (!aisPortName) return null;

  const matchResult = matchPortByName(ports, aisPortName);

  return (
    <Stack gap={4}>
      <Group justify="space-between" align="center">
        <Box>
          <Text size="xs" c="dimmed" fw={500}>
            {label}
          </Text>
          <Text size="sm">{aisPortName}</Text>
        </Box>
        {matchResult.status === 'match' && (
          <Button size="xs" variant="light" onClick={onApply}>
            Apply
          </Button>
        )}
      </Group>
      {hint && (
        <Text size="xs" c="orange">
          {hint}
        </Text>
      )}
      {!hint && matchResult.status === 'none' && (
        <Text size="xs" c="dimmed">
          Couldn't find this port in master-data — pick manually
        </Text>
      )}
      {!hint && matchResult.status === 'multiple' && (
        <Text size="xs" c="dimmed">
          Multiple ports match — pick manually
        </Text>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AisSuggestionPanel({ imo, form }: AisSuggestionPanelProps) {
  const aisQuery = useAisLookup(imo);

  // Fetch all ports for matching (200 covers typical master-data size)
  const portsQuery = useQuery({
    queryKey: ['ports-for-ais', 'all'],
    queryFn: () => apiRequest<PortListResponse>('/master-data/ports?limit=200'),
    staleTime: 60_000,
  });

  const ports = portsQuery.data?.items ?? [];

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (aisQuery.isPending) {
    return (
      <Group gap="xs" py="xs">
        <Loader size="xs" />
        <Text size="sm" c="dimmed">
          Looking up AIS data...
        </Text>
      </Group>
    );
  }

  // ---------------------------------------------------------------------------
  // Error states
  // ---------------------------------------------------------------------------

  if (aisQuery.isError) {
    const err = aisQuery.error;
    const status = err instanceof ApiError ? err.status : 0;

    if (status === 404) {
      return (
        <Alert color="gray" title="No AIS data">
          No AIS data for this vessel.
        </Alert>
      );
    }

    if (status === 503) {
      return (
        <Alert color="yellow" title="AIS lookup unavailable">
          AIS lookup unavailable. Configure VESSELFINDER_API_KEY on the server.
        </Alert>
      );
    }

    if (status === 502) {
      return (
        <Alert color="yellow" title="AIS provider error">
          AIS provider returned an error. Please try again later.
        </Alert>
      );
    }

    // Generic / network error
    return (
      <Alert color="yellow" title="AIS lookup unavailable">
        AIS lookup unavailable. Please try again later.
      </Alert>
    );
  }

  // ---------------------------------------------------------------------------
  // No data (should not normally reach here, but guard anyway)
  // ---------------------------------------------------------------------------

  if (!aisQuery.data) {
    return (
      <Alert color="gray" title="No AIS data">
        No AIS data for this vessel.
      </Alert>
    );
  }

  const vessel: AisVessel = aisQuery.data;

  // ---------------------------------------------------------------------------
  // Apply helpers
  // ---------------------------------------------------------------------------

  function applyEta() {
    if (!vessel.eta) return;
    form.setValue('etaDate', new Date(vessel.eta));
    notifications.show({
      color: 'green',
      message: 'ETA date set from AIS data',
    });
  }

  function applyPort(aisPortName: string | null, field: PortField) {
    if (!aisPortName) return;
    const result = matchPortByName(ports, aisPortName);
    if (result.status === 'match') {
      form.setValue(field, result.port.id);
      notifications.show({
        color: 'green',
        message: `Port set from AIS data`,
      });
    }
  }

  function applyAll() {
    if (vessel.eta) applyEta();
    if (vessel.lastPort?.name) applyPort(vessel.lastPort.name, 'lastPortId');
    if (vessel.nextPort?.name) applyPort(vessel.nextPort.name, 'nextPortId');
  }

  // ---------------------------------------------------------------------------
  // Render success panel
  // ---------------------------------------------------------------------------

  return (
    <Card withBorder padding="sm" radius="sm" bg="blue.0">
      <Stack gap="sm">
        {/* Header row */}
        <Group justify="space-between" align="flex-start">
          <Box>
            <Text size="sm" fw={700}>
              AIS Data — {vessel.name}
            </Text>
            {vessel.lastPosition && (
              <Text size="xs" c="dimmed">
                Position: {formatLatLon(vessel.lastPosition.lat, vessel.lastPosition.lon)}
                {vessel.lastPosition.timestampUtc
                  ? ` as of ${formatUtc(vessel.lastPosition.timestampUtc)}`
                  : ''}
              </Text>
            )}
          </Box>
          <Button size="xs" variant="filled" onClick={applyAll}>
            Apply All
          </Button>
        </Group>

        {/* ETA suggestion */}
        {vessel.eta && (
          <Group justify="space-between" align="center">
            <Box>
              <Text size="xs" c="dimmed" fw={500}>
                ETA (from AIS)
              </Text>
              <Text size="sm">{formatUtc(vessel.eta)}</Text>
            </Box>
            <Button size="xs" variant="light" onClick={applyEta}>
              Apply
            </Button>
          </Group>
        )}

        {/* Last port suggestion */}
        <PortSuggestionRow
          label="Last Port (from AIS)"
          aisPortName={vessel.lastPort?.name}
          ports={ports}
          hint={null}
          onApply={() => applyPort(vessel.lastPort?.name ?? null, 'lastPortId')}
        />

        {/* Next port suggestion */}
        <PortSuggestionRow
          label="Next Port (from AIS)"
          aisPortName={vessel.nextPort?.name}
          ports={ports}
          hint={null}
          onApply={() => applyPort(vessel.nextPort?.name ?? null, 'nextPortId')}
        />

        {/* Footer */}
        <Text size="xs" c="dimmed">
          Last AIS update: {formatUtc(vessel.fetchedAt)}
        </Text>
      </Stack>
    </Card>
  );
}
