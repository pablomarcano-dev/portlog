import { useMemo } from 'react';
import {
  Modal,
  Stack,
  Text,
  Title,
  Button,
  Group,
  Table,
  Badge,
  Loader,
  Center,
  Alert,
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { VesselInfo } from '@portlog/schemas';
import type { EnrichedVessel } from '../lib/types';
import { useDatalastic } from '../api/useDatalastic';
import { useFlags, flagsApi } from '../../../lib/api/master-data/flags';
import {
  useShipParticularByImo,
  shipParticularsApi,
} from '../../../lib/api/master-data/ship-particulars';
import type { ShipParticularRecord } from '../../../lib/api/master-data/ship-particulars';

interface VesselInfoResponse {
  data: VesselInfo;
}

interface SaveVesselModalProps {
  vessel: EnrichedVessel | null;
  opened: boolean;
  onClose: () => void;
}

// Fields we can populate from AIS + Datalastic vessel_info.
interface IncomingData {
  name: string;
  imoNumber: string;
  callSign: string | undefined;
  loa: number | undefined;
  dwt: number | undefined;
  grt: number | undefined;
  flagId: string | undefined;
  flagAbbr: string | undefined;
  countryName: string | undefined;
}

// Human-readable label for each comparable field.
const FIELD_LABELS: Record<keyof Omit<IncomingData, 'flagId' | 'countryName'>, string> = {
  name: 'Name',
  imoNumber: 'IMO',
  callSign: 'Call Sign',
  loa: 'LOA (m)',
  dwt: 'DWT',
  grt: 'GRT',
  flagAbbr: 'Flag',
};

function cleanCallSign(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.length >= 3 && cleaned.length <= 15 ? cleaned : undefined;
}

function numOrUndef(v: number | null | undefined): number | undefined {
  return v != null && v > 0 ? v : undefined;
}

export function SaveVesselModal({ vessel, opened, onClose }: SaveVesselModalProps) {
  const imo = vessel?.imo ?? null;

  // Fetch vessel_info for callsign + dimensions
  const { data: vesselInfoRaw, isLoading: infoLoading } = useDatalastic<VesselInfoResponse>(
    'vessel_info',
    imo ? { imo } : {},
    { enabled: !!imo },
  );
  const vesselInfo = vesselInfoRaw?.data;

  // Check if IMO already exists in our DB
  const { data: existing, isLoading: existingLoading } = useShipParticularByImo(imo);

  // Fetch flags to resolve country_iso → flagId
  const { data: flagsData, isLoading: flagsLoading } = useFlags({ limit: 200 });

  const isLoading = infoLoading || existingLoading || flagsLoading;

  // Resolve flag from country_iso
  const flagRecord = useMemo(() => {
    if (!vessel || !flagsData) return undefined;
    return flagsData.items.find(
      (f) => f.abbreviation?.toUpperCase() === vessel.country_iso?.toUpperCase(),
    );
  }, [vessel, flagsData]);

  // Assemble incoming data from AIS + vessel_info
  const incoming = useMemo((): IncomingData | null => {
    if (!vessel) return null;
    return {
      name: vessel.name,
      imoNumber: vessel.imo,
      callSign: cleanCallSign(vesselInfo?.callsign),
      loa: numOrUndef(vesselInfo?.length),
      dwt: numOrUndef(vesselInfo?.deadweight),
      grt: numOrUndef(vesselInfo?.gross_tonnage),
      flagId: flagRecord?.id,
      flagAbbr: vessel.country_iso || undefined,
      countryName: vesselInfo?.country_name || undefined,
    };
  }, [vessel, vesselInfo, flagRecord]);

  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!incoming) throw new Error('No incoming data.');

      // Resolve flagId — auto-create the flag if it's not in our DB yet
      let flagId = incoming.flagId;
      if (!flagId && incoming.flagAbbr) {
        const newFlag = await flagsApi.create({
          name: incoming.countryName ?? incoming.flagAbbr,
          abbreviation: incoming.flagAbbr,
        });
        flagId = newFlag.id;
        void qc.invalidateQueries({ queryKey: ['flags'] });
        notifications.show({
          color: 'blue',
          message: `Flag "${incoming.flagAbbr}" auto-created.`,
        });
      }

      if (!flagId) throw new Error('Could not resolve or create a flag for this vessel.');

      return shipParticularsApi.create({
        name: incoming.name,
        imoNumber: incoming.imoNumber || undefined,
        callSign: incoming.callSign,
        loa: incoming.loa,
        dwt: incoming.dwt,
        grt: incoming.grt,
        flagId,
      });
    },
    onSuccess: (record) => {
      void qc.invalidateQueries({ queryKey: ['ship-particulars'] });
      notifications.show({ color: 'green', message: `${record.name} added to Ship Particulars.` });
      onClose();
    },
    onError: (err) => {
      notifications.show({
        color: 'red',
        title: 'Create failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) => {
      if (!incoming) throw new Error('No incoming data.');
      return shipParticularsApi.update(id, {
        name: incoming.name,
        imoNumber: incoming.imoNumber || undefined,
        callSign: incoming.callSign,
        loa: incoming.loa,
        dwt: incoming.dwt,
        grt: incoming.grt,
        ...(incoming.flagId ? { flagId: incoming.flagId } : {}),
      });
    },
    onSuccess: (record) => {
      void qc.invalidateQueries({ queryKey: ['ship-particulars'] });
      notifications.show({ color: 'teal', message: `${record.name} updated in Ship Particulars.` });
      onClose();
    },
    onError: (err) => {
      notifications.show({
        color: 'red',
        title: 'Update failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    },
  });

  if (!vessel) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Title order={4}>Save to Ship Particulars — {vessel.name}</Title>}
      size="lg"
    >
      {isLoading ? (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      ) : existing ===
        undefined ? // existing is undefined when query hasn't run (shouldn't happen since imo is set)
      null : existing === null ? (
        <CreateView
          vessel={vessel}
          incoming={incoming}
          isPending={createMutation.isPending}
          onConfirm={() => createMutation.mutate()}
          onCancel={onClose}
        />
      ) : (
        <UpdateView
          existing={existing}
          incoming={incoming}
          isPending={updateMutation.isPending}
          onConfirm={() => updateMutation.mutate(existing.id)}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Create view — vessel not in our DB yet
// ---------------------------------------------------------------------------

function CreateView({
  vessel,
  incoming,
  isPending,
  onConfirm,
  onCancel,
}: {
  vessel: EnrichedVessel;
  incoming: IncomingData | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const flagResolved = !!incoming?.flagId;
  return (
    <Stack gap="md">
      <Text size="sm">
        <strong>{vessel.name}</strong> (IMO {vessel.imo}) is not yet in the database. The following
        data will be saved:
      </Text>

      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Field</Table.Th>
            <Table.Th>Value</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {incoming &&
            (Object.entries(FIELD_LABELS) as [keyof typeof FIELD_LABELS, string][]).map(
              ([key, label]) => {
                const val = incoming[key];
                if (val === undefined) return null;
                return (
                  <Table.Tr key={key}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {label}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{String(val)}</Text>
                    </Table.Td>
                  </Table.Tr>
                );
              },
            )}
        </Table.Tbody>
      </Table>

      {!flagResolved && vessel.country_iso && (
        <Alert color="blue" title="Flag will be auto-created">
          "{vessel.country_iso}" is not yet in the Flags catalog. It will be added automatically
          when this vessel is saved.
        </Alert>
      )}

      <Divider />

      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm} loading={isPending}>
          Create Vessel
        </Button>
      </Group>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Update view — vessel already in our DB, show diff
// ---------------------------------------------------------------------------

function UpdateView({
  existing,
  incoming,
  isPending,
  onConfirm,
  onCancel,
}: {
  existing: ShipParticularRecord;
  incoming: IncomingData | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Compute diff: fields where incoming differs from existing
  const diffRows = useMemo(() => {
    if (!incoming) return [];

    const existingMapped: Record<keyof typeof FIELD_LABELS, string | undefined> = {
      name: existing.name,
      imoNumber: existing.imoNumber ?? undefined,
      callSign: existing.callSign ?? undefined,
      loa: existing.loa != null ? String(existing.loa) : undefined,
      dwt: existing.dwt != null ? String(existing.dwt) : undefined,
      grt: existing.grt != null ? String(existing.grt) : undefined,
      flagAbbr: undefined, // we don't resolve existing flag abbreviation here
    };

    return (Object.entries(FIELD_LABELS) as [keyof typeof FIELD_LABELS, string][])
      .map(([key, label]) => {
        const incomingVal = incoming[key] !== undefined ? String(incoming[key]) : undefined;
        const existingVal = existingMapped[key];
        const changed =
          incomingVal !== undefined && incomingVal !== '' && incomingVal !== existingVal;
        return {
          key,
          label,
          existingVal: existingVal ?? '—',
          incomingVal: incomingVal ?? '—',
          changed,
        };
      })
      .filter((r) => r.changed);
  }, [existing, incoming]);

  const unchangedCount = Object.keys(FIELD_LABELS).length - diffRows.length;

  return (
    <Stack gap="md">
      <Alert color="blue" title="Vessel already in database">
        A Ship Particular with IMO <strong>{existing.imoNumber}</strong> already exists (
        <em>{existing.name}</em>).
      </Alert>

      {diffRows.length === 0 ? (
        <Text size="sm" c="dimmed">
          All available fields already match — no update needed.
        </Text>
      ) : (
        <>
          <Text size="sm">
            {diffRows.length} field{diffRows.length > 1 ? 's' : ''} differ from the AIS data.
            {unchangedCount > 0 &&
              ` ${unchangedCount} field${unchangedCount > 1 ? 's' : ''} unchanged.`}
          </Text>

          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Field</Table.Th>
                <Table.Th>Current (DB)</Table.Th>
                <Table.Th>From AIS</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {diffRows.map((row) => (
                <Table.Tr key={row.key}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {row.label}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {row.existingVal}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Text size="sm">{row.incomingVal}</Text>
                      <Badge size="xs" color="blue">
                        new
                      </Badge>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      <Divider />

      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        {diffRows.length > 0 && (
          <Button color="teal" onClick={onConfirm} loading={isPending}>
            Update Vessel
          </Button>
        )}
      </Group>
    </Stack>
  );
}
