import { Box, Button, Card, Group, Loader, Alert, SimpleGrid, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useWatch } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import type { ShipParticularCreateInput } from '@portlog/schemas';
import type { VesselInfo } from '@portlog/schemas';
import { useDatalastic } from '../../vessels/api/useDatalastic';
import { ApiError } from '../../../lib/api/errors';
import { useFlags, flagsApi } from '../../../lib/api/master-data/flags';
import { useQueryClient } from '@tanstack/react-query';

interface VesselInfoResponse {
  data: VesselInfo;
}

interface DatalasticImoLookupProps {
  form: UseFormReturn<ShipParticularCreateInput>;
}

type NumericFormField = 'loa' | 'dwt' | 'grt' | 'nrt';
type StringFormField = 'name' | 'callSign';

interface StringSuggestionField {
  label: string;
  datalasticValue: string;
  formField: StringFormField;
  currentValue: string | undefined;
}

interface NumericSuggestionField {
  label: string;
  datalasticValue: number;
  formField: NumericFormField;
  currentValue: number | undefined;
}

type SuggestionField = StringSuggestionField | NumericSuggestionField;

/**
 * DatalasticImoLookup — watches the imoNumber field and when it's a valid
 * 7-digit IMO, fetches vessel_info from Datalastic and shows a suggestion card
 * for auto-populating ship particular fields.
 */
export function DatalasticImoLookup({ form }: DatalasticImoLookupProps) {
  const imoNumber = useWatch({ control: form.control, name: 'imoNumber' });
  const qc = useQueryClient();

  const isValidImo = typeof imoNumber === 'string' && /^\d{7}$/.test(imoNumber);

  const { data, isLoading, isError, error } = useDatalastic<VesselInfoResponse>(
    'vessel_info',
    isValidImo ? { imo: imoNumber } : {},
    { enabled: isValidImo },
  );

  const { data: flagsData } = useFlags({ limit: 200 });

  const vesselInfo = data?.data;

  if (!isValidImo) return null;

  if (isLoading) {
    return (
      <Group gap="xs" py="xs">
        <Loader size="xs" />
        <Text size="sm" c="dimmed">
          Looking up vessel data from Datalastic…
        </Text>
      </Group>
    );
  }

  if (isError) {
    const status = error instanceof ApiError ? error.status : 0;
    if (status === 404) {
      return (
        <Text size="sm" c="dimmed">
          No Datalastic record found for IMO {imoNumber}.
        </Text>
      );
    }
    if (status === 503) {
      return (
        <Alert color="yellow" title="Datalastic not configured">
          DATALASTIC_API_KEY is not set on the server.
        </Alert>
      );
    }
    return (
      <Alert color="yellow" title="Datalastic unavailable">
        Could not fetch vessel data right now. The form can still be saved manually.
      </Alert>
    );
  }

  if (!vesselInfo) return null;

  const currentValues = form.getValues();

  // Resolve flag from Datalastic's country_iso against our flags list
  const flagRecord = flagsData?.items.find(
    (f) => f.abbreviation?.toUpperCase() === vesselInfo.country_iso?.toUpperCase(),
  );
  const flagMissing = !currentValues.flagId && vesselInfo.country_iso;
  const flagDiffers = currentValues.flagId && flagRecord && currentValues.flagId !== flagRecord.id;
  const needsFlagSuggestion = !!(flagMissing || flagDiffers);

  const strFields: StringSuggestionField[] = [
    {
      label: 'Name',
      datalasticValue: vesselInfo.name,
      formField: 'name',
      currentValue: currentValues.name,
    },
    {
      label: 'Callsign',
      datalasticValue: vesselInfo.callsign,
      formField: 'callSign',
      currentValue: currentValues.callSign ?? undefined,
    },
  ].filter((f): f is StringSuggestionField => !!f.datalasticValue);

  const numFields: NumericSuggestionField[] = [
    {
      label: 'LOA (m)',
      datalasticValue: vesselInfo.length ?? 0,
      formField: 'loa',
      currentValue: currentValues.loa ?? undefined,
    },
    {
      label: 'DWT',
      datalasticValue: vesselInfo.deadweight ?? 0,
      formField: 'dwt',
      currentValue: currentValues.dwt ?? undefined,
    },
    {
      label: 'GRT',
      datalasticValue: vesselInfo.gross_tonnage ?? 0,
      formField: 'grt',
      currentValue: currentValues.grt ?? undefined,
    },
  ].filter((f): f is NumericSuggestionField => !!f.datalasticValue);

  const allFields: SuggestionField[] = [...strFields, ...numFields];

  const diffFields = allFields.filter(
    (f) => String(f.datalasticValue) !== String(f.currentValue ?? ''),
  );

  const hasAnySuggestion = diffFields.length > 0 || needsFlagSuggestion;

  if (!hasAnySuggestion) {
    return (
      <Card withBorder p="sm" radius="sm" bg="green.0">
        <Text size="sm" c="green.7">
          All fields match Datalastic data for IMO {imoNumber}.
        </Text>
      </Card>
    );
  }

  const countryIso = vesselInfo.country_iso;
  const countryName = vesselInfo.country_name;

  async function applyFlag() {
    if (!countryIso) return;
    let resolvedId = flagRecord?.id;
    if (!resolvedId) {
      const newFlag = await flagsApi.create({
        name: countryName ?? countryIso,
        abbreviation: countryIso,
      });
      resolvedId = newFlag.id;
      void qc.invalidateQueries({ queryKey: ['flags'] });
      notifications.show({
        color: 'blue',
        message: `Flag "${countryIso}" auto-created.`,
      });
    }
    form.setValue('flagId', resolvedId);
    notifications.show({ color: 'green', message: 'Flag updated from Datalastic' });
  }

  function applyField(field: SuggestionField) {
    if (
      field.formField === 'loa' ||
      field.formField === 'dwt' ||
      field.formField === 'grt' ||
      field.formField === 'nrt'
    ) {
      form.setValue(field.formField, Number(field.datalasticValue));
    } else {
      form.setValue(field.formField, String(field.datalasticValue));
    }
    notifications.show({
      color: 'green',
      message: `${field.label} updated from Datalastic`,
    });
  }

  async function applyAll() {
    for (const f of diffFields) {
      applyField(f);
    }
    if (needsFlagSuggestion) {
      await applyFlag();
    } else {
      notifications.show({
        color: 'green',
        message: 'All fields updated from Datalastic',
      });
    }
  }

  return (
    <Card withBorder p="sm" radius="sm" bg="blue.0">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Box>
            <Text size="sm" fw={700}>
              Datalastic — {vesselInfo.name}
            </Text>
            <Text size="xs" c="dimmed">
              {vesselInfo.type_specific || vesselInfo.type} · {vesselInfo.country_name} · Year:{' '}
              {vesselInfo.year_built ?? '—'}
            </Text>
          </Box>
          <Button size="xs" variant="filled" onClick={() => void applyAll()}>
            Apply All
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {diffFields.map((f) => (
            <Group key={f.label} justify="space-between" align="center">
              <Box>
                <Text size="xs" c="dimmed" fw={500}>
                  {f.label}
                </Text>
                <Text size="sm">{String(f.datalasticValue)}</Text>
              </Box>
              <Button size="xs" variant="light" onClick={() => applyField(f)}>
                Apply
              </Button>
            </Group>
          ))}
          {needsFlagSuggestion && (
            <Group justify="space-between" align="center">
              <Box>
                <Text size="xs" c="dimmed" fw={500}>
                  Flag
                </Text>
                <Text size="sm">
                  {countryName ?? countryIso}
                  {!flagRecord && (
                    <Text span size="xs" c="dimmed">
                      {' '}
                      (will be created)
                    </Text>
                  )}
                </Text>
              </Box>
              <Button size="xs" variant="light" onClick={() => void applyFlag()}>
                Apply
              </Button>
            </Group>
          )}
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
