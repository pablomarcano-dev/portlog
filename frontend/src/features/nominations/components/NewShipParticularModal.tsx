import { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  NumberInput,
} from '@mantine/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import { apiRequest } from '../../../lib/api/client';
import { ApiError } from '../../../lib/api/errors';
import { shipParticularsApi } from '../../../lib/api/master-data/ship-particulars';
import { flagsApi } from '../../../lib/api/master-data/flags';
import { vesselInfoSchema, vesselParticularsSchema } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const QuickShipSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  imoNumber: z
    .string()
    .regex(/^\d{7}$/, 'Must be exactly 7 digits')
    .optional()
    .or(z.literal('')),
  callSign: z
    .string()
    .regex(/^[A-Z0-9]*$/, 'Uppercase alphanumeric only')
    .min(0)
    .max(15)
    .optional()
    .or(z.literal('')),
  flagId: z.string().cuid('Flag is required'),
  dwt: z.number().nonnegative().nullable().optional(),
  grt: z.number().nonnegative().nullable().optional(),
  loa: z.number().nonnegative().nullable().optional(),
});

type QuickShipInput = z.infer<typeof QuickShipSchema>;

// ---------------------------------------------------------------------------
// IMO lookup result types
// ---------------------------------------------------------------------------

type ImoLookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'exists'; id: string; name: string }
  | {
      status: 'prefilled';
      vesselName: string;
      fields: string[];
      flagPreserved: boolean;
      flagMatched: boolean;
    }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanCallSign(raw: string | undefined): string {
  if (!raw) return '';
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.length >= 3 && cleaned.length <= 15 ? cleaned : '';
}

interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewShipParticularModal({ opened, onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const lookupVersion = useRef(0);
  const flagManuallySelected = useRef(false);
  const [flagSearch, setFlagSearch] = useState('');
  const [lookupFlagOption, setLookupFlagOption] = useState<{ value: string; label: string } | null>(
    null,
  );
  const [imoLookup, setImoLookup] = useState<ImoLookupState>({ status: 'idle' });

  const form = useForm<QuickShipInput>({
    resolver: zodResolver(QuickShipSchema),
    defaultValues: { name: '', imoNumber: '', callSign: '', flagId: '' },
  });

  const { register, handleSubmit, control, formState, reset, watch, setValue } = form;

  const imoValue = watch('imoNumber');
  const isValidImo = typeof imoValue === 'string' && /^\d{7}$/.test(imoValue);

  // Reset lookup state when IMO changes
  useEffect(() => {
    lookupVersion.current += 1;
    setImoLookup({ status: 'idle' });
  }, [imoValue]);

  // Reset everything when modal closes
  useEffect(() => {
    if (!opened) {
      lookupVersion.current += 1;
      flagManuallySelected.current = false;
      reset();
      setFlagSearch('');
      setLookupFlagOption(null);
      setImoLookup({ status: 'idle' });
    }
  }, [opened, reset]);

  async function handleImoLookup() {
    if (!isValidImo || !imoValue) return;
    setImoLookup({ status: 'loading' });

    const version = ++lookupVersion.current;
    try {
      // Check the directory first; failures must leave the loading state too.
      const existing = await shipParticularsApi.getByImo(imoValue);
      if (version !== lookupVersion.current) return;
      if (existing !== null) {
        setImoLookup({ status: 'exists', id: existing.id, name: existing.name });
        return;
      }

      const res = await apiRequest<{ data: unknown }>(`/datalastic/vessel_info?imo=${imoValue}`);
      const info = vesselInfoSchema
        .pick({ name: true, country_iso: true, country_name: true, callsign: true })
        .partial()
        .parse(res.data);
      const particulars = vesselParticularsSchema.safeParse(res.data);
      let resolvedFlagId = '';
      let resolvedFlagName = '';
      try {
        const code = info.country_iso?.trim().toUpperCase();
        if (code) {
          const flags = await flagsApi.list({ q: code, limit: 200 });
          const matches = flags.items.filter(
            (flag) => flag.abbreviation?.trim().toUpperCase() === code,
          );
          if (matches.length === 1 && matches[0]) {
            resolvedFlagId = matches[0].id;
            resolvedFlagName = matches[0].name;
          }
        }
        // Locally maintained flags may use a three-letter abbreviation.
        if (!resolvedFlagId && info.country_name?.trim()) {
          const countryName = info.country_name.trim();
          const flags = await flagsApi.list({ q: countryName, limit: 200 });
          const matches = flags.items.filter(
            (flag) => flag.name.trim().toLowerCase() === countryName.toLowerCase(),
          );
          if (matches.length === 1 && matches[0]) {
            resolvedFlagId = matches[0].id;
            resolvedFlagName = matches[0].name;
          }
        }
      } catch {
        // An unavailable flag catalogue must not prevent manual vessel entry.
      }
      if (version !== lookupVersion.current) return;
      const fields: string[] = [];
      if (particulars.success && (!particulars.data.imo || particulars.data.imo === imoValue)) {
        for (const [field, value] of [
          ['dwt', particulars.data.deadweight],
          ['grt', particulars.data.gross_tonnage],
          ['loa', particulars.data.length],
        ] as const) {
          if (value != null) {
            setValue(field, value, { shouldDirty: true });
            fields.push(field.toUpperCase());
          }
        }
      }
      if (info.name?.trim()) {
        setValue('name', info.name.trim(), { shouldDirty: true });
        fields.push('name');
      }
      const callSign = cleanCallSign(info.callsign);
      if (callSign) {
        setValue('callSign', callSign, { shouldDirty: true });
        fields.push('call sign');
      }
      const flagPreserved = flagManuallySelected.current;
      if (resolvedFlagId && !flagPreserved) {
        setValue('flagId', resolvedFlagId, { shouldDirty: true, shouldValidate: true });
        setLookupFlagOption({ value: resolvedFlagId, label: resolvedFlagName });
        fields.push('flag');
      }
      setImoLookup({
        status: 'prefilled',
        vesselName: info.name ?? imoValue,
        fields,
        flagPreserved,
        flagMatched: Boolean(resolvedFlagId),
      });
    } catch (err) {
      if (version !== lookupVersion.current) return;
      if (err instanceof ApiError && err.status === 404) {
        setImoLookup({ status: 'not_found' });
      } else if (err instanceof ApiError && err.status === 503) {
        setImoLookup({
          status: 'error',
          message: 'Vessel lookup is not available. You can enter the details manually.',
        });
      } else {
        setImoLookup({
          status: 'error',
          message: 'Could not complete the lookup. Please retry or enter the details manually.',
        });
      }
    }
  }

  function handleSelectExisting() {
    if (imoLookup.status !== 'exists') return;
    void qc.invalidateQueries({ queryKey: ['entity-picker', '/master-data/ship-particulars'] });
    onCreated(imoLookup.id, imoLookup.name);
    reset();
    onClose();
  }

  const create = useMutation({
    mutationFn: (data: QuickShipInput) => {
      const payload: Record<string, unknown> = { name: data.name, flagId: data.flagId };
      if (data.imoNumber) payload.imoNumber = data.imoNumber;
      if (data.callSign) payload.callSign = data.callSign;
      for (const field of ['dwt', 'grt', 'loa'] as const)
        if (data[field] != null) payload[field] = data[field];
      return apiRequest<{ id: string; name: string }>('/master-data/ship-particulars', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (ship) => {
      void qc.invalidateQueries({ queryKey: ['entity-picker', '/master-data/ship-particulars'] });
      void qc.invalidateQueries({ queryKey: ['ship-particulars'] });
      onCreated(ship.id, ship.name);
      reset();
      onClose();
    },
  });

  function handleClose() {
    lookupVersion.current += 1;
    flagManuallySelected.current = false;
    reset();
    setImoLookup({ status: 'idle' });
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="New Ship Particular"
      size="70vw"
      styles={{
        content: {
          resize: 'both',
          overflow: 'auto',
          width: '100%',
          minWidth: 400,
        },
      }}
    >
      <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate>
        <Stack gap="sm">
          {/* IMO — with inline lookup */}
          <Group gap="xs" align="flex-end">
            <TextInput
              label="IMO Number"
              placeholder="7 digits"
              error={formState.errors.imoNumber?.message}
              style={{ flex: 1 }}
              {...register('imoNumber')}
            />
            {isValidImo && (
              <Button
                size="sm"
                variant="light"
                loading={imoLookup.status === 'loading'}
                onClick={() => void handleImoLookup()}
                mb={formState.errors.imoNumber ? 20 : 0}
              >
                Look up
              </Button>
            )}
          </Group>

          {/* IMO lookup result */}
          {imoLookup.status === 'exists' && (
            <Alert color="blue" title="Already in database">
              <Stack gap="xs">
                <Text size="sm">
                  <strong>{imoLookup.name}</strong> is already in Ship Particulars.
                </Text>
                <Button size="xs" variant="filled" onClick={handleSelectExisting}>
                  Select this vessel
                </Button>
              </Stack>
            </Alert>
          )}

          {imoLookup.status === 'prefilled' && (
            <Alert color="teal" title="Pre-filled from Datalastic">
              <Text size="sm">
                Found <strong>{imoLookup.vesselName}</strong> in Datalastic.{' '}
                {imoLookup.fields.length
                  ? `Pre-filled: ${imoLookup.fields.join(', ')}.`
                  : 'No fields were pre-filled.'}{' '}
                {imoLookup.flagPreserved
                  ? 'Your flag selection was kept. '
                  : !imoLookup.flagMatched
                    ? 'No matching flag was found; select it manually. '
                    : ''}
                Review the details before clicking <strong>Create Ship</strong>.
              </Text>
            </Alert>
          )}

          {imoLookup.status === 'not_found' && (
            <Text size="xs" c="dimmed">
              IMO {imoValue} not found in our database or Datalastic.
            </Text>
          )}

          {imoLookup.status === 'error' && (
            <Text size="xs" c="orange">
              {imoLookup.message}
            </Text>
          )}

          <Divider />

          {/* Fields — always editable regardless of lookup result */}
          <TextInput
            label="Ship Name"
            required
            error={formState.errors.name?.message}
            {...register('name')}
          />

          <Controller
            name="flagId"
            control={control}
            render={({ field, fieldState }) => (
              <EntityPicker
                endpoint="/master-data/flags"
                label="Flag"
                selectedOption={lookupFlagOption}
                required
                value={field.value || null}
                onChange={(val) => {
                  flagManuallySelected.current = true;
                  field.onChange(val ?? '');
                }}
                searchValue={flagSearch}
                onSearchChange={setFlagSearch}
                error={fieldState.error?.message}
              />
            )}
          />

          <TextInput
            label="Call Sign"
            placeholder="Uppercase alphanumeric"
            error={formState.errors.callSign?.message}
            {...register('callSign')}
          />

          {imoLookup.status === 'prefilled' && (
            <Badge color="teal" variant="light" size="sm">
              Pre-filled from Datalastic — save to confirm
            </Badge>
          )}

          <Group grow>
            {(['dwt', 'grt', 'loa'] as const).map((name) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <NumberInput
                    label={name === 'dwt' ? 'SDWT' : name === 'loa' ? 'LOA (m)' : 'GRT'}
                    min={0}
                    value={field.value ?? ''}
                    onChange={(value) => field.onChange(value === '' ? null : Number(value))}
                  />
                )}
              />
            ))}
          </Group>
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={handleClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create Ship
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
