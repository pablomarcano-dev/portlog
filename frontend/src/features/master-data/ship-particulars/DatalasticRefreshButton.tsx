import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useWatch } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import type { ShipParticularCreateInput } from '@portlog/schemas';
import type { VesselInfo } from '@portlog/schemas';
import { apiRequest } from '../../../lib/api/client';
import { ApiError } from '../../../lib/api/errors';

interface VesselInfoResponse {
  data: VesselInfo;
}

interface DiffRow {
  field: string;
  label: string;
  current: string;
  incoming: string;
  formKey: keyof ShipParticularCreateInput;
  incomingValue: string | number | undefined;
}

function cleanCallSign(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.length >= 3 && cleaned.length <= 15 ? cleaned : undefined;
}

function numOrUndef(v: number | null | undefined): number | undefined {
  return v != null && v > 0 ? v : undefined;
}

function fmt(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—';
  return String(v);
}

interface DatalasticRefreshButtonProps {
  form: UseFormReturn<ShipParticularCreateInput>;
}

export function DatalasticRefreshButton({ form }: DatalasticRefreshButtonProps) {
  const imoNumber = useWatch({ control: form.control, name: 'imoNumber' });
  const isValidImo = typeof imoNumber === 'string' && /^\d{7}$/.test(imoNumber);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffRows, setDiffRows] = useState<DiffRow[] | null>(null);

  if (!isValidImo) return null;

  async function handleRefresh() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<VesselInfoResponse>(`/datalastic/vessel_info?imo=${imoNumber}`);
      const info = res.data;

      const current = form.getValues();

      const candidates: Array<{
        field: string;
        label: string;
        formKey: keyof ShipParticularCreateInput;
        incomingValue: string | number | undefined;
      }> = [
        {
          field: 'name',
          label: 'Name',
          formKey: 'name',
          incomingValue: info.name || undefined,
        },
        {
          field: 'callSign',
          label: 'Call Sign',
          formKey: 'callSign',
          incomingValue: cleanCallSign(info.callsign),
        },
        {
          field: 'loa',
          label: 'LOA (m)',
          formKey: 'loa',
          incomingValue: numOrUndef(info.length),
        },
        {
          field: 'dwt',
          label: 'DWT',
          formKey: 'dwt',
          incomingValue: numOrUndef(info.deadweight),
        },
        {
          field: 'grt',
          label: 'GRT',
          formKey: 'grt',
          incomingValue: numOrUndef(info.gross_tonnage),
        },
      ];

      const diff: DiffRow[] = candidates
        .filter((c) => {
          if (c.incomingValue === undefined) return false;
          const cur = current[c.formKey];
          return fmt(c.incomingValue) !== fmt(cur as string | number | null | undefined);
        })
        .map((c) => ({
          ...c,
          current: fmt(current[c.formKey] as string | number | null | undefined),
          incoming: fmt(c.incomingValue),
        }));

      setDiffRows(diff);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError(`No Datalastic record found for IMO ${imoNumber}.`);
      } else if (err instanceof ApiError && err.status === 503) {
        setError('Datalastic API key is not configured on the server.');
      } else {
        setError('Could not reach Datalastic right now. Try again later.');
      }
    } finally {
      setLoading(false);
    }
  }

  function applyAll() {
    if (!diffRows) return;
    for (const row of diffRows) {
      const val = row.incomingValue;
      if (typeof val === 'number') {
        form.setValue(row.formKey, val as never, { shouldDirty: true });
      } else if (typeof val === 'string') {
        form.setValue(row.formKey, val as never, { shouldDirty: true });
      }
    }
    setDiffRows(null);
  }

  const hasChanges = diffRows !== null && diffRows.length > 0;
  const noChanges = diffRows !== null && diffRows.length === 0;

  return (
    <>
      <Group gap="xs" align="center">
        <Button size="xs" variant="light" loading={loading} onClick={() => void handleRefresh()}>
          Refresh from Datalastic
        </Button>
        {error && (
          <Text size="xs" c="red">
            {error}
          </Text>
        )}
        {noChanges && (
          <Text size="xs" c="green">
            All fields already match Datalastic.
          </Text>
        )}
      </Group>

      <Modal
        opened={hasChanges}
        onClose={() => setDiffRows(null)}
        title={<Title order={4}>Datalastic — Fields to Update</Title>}
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">
            The following fields differ from the latest Datalastic data for IMO{' '}
            <strong>{imoNumber}</strong>. Select "Apply All" to overwrite them in the form (the
            record is not saved until you click Save).
          </Text>

          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Field</Table.Th>
                <Table.Th>Current</Table.Th>
                <Table.Th>From Datalastic</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {diffRows?.map((row) => (
                <Table.Tr key={row.field}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {row.label}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {row.current}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Text size="sm">{row.incoming}</Text>
                      <Badge size="xs" color="blue">
                        new
                      </Badge>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Alert color="yellow" variant="light">
            These changes will be applied to the form only. Click <strong>Save</strong> afterwards
            to persist them.
          </Alert>

          <Divider />

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDiffRows(null)}>
              Cancel
            </Button>
            <Button onClick={applyAll}>Apply All</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
