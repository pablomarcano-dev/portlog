import { useState, useEffect } from 'react';
import { Alert, Badge, Button, Divider, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
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
import type { VesselInfo } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const QuickShipSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  abbreviation: z.string().min(1).max(20).optional().or(z.literal('')),
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
});

type QuickShipInput = z.infer<typeof QuickShipSchema>;

// ---------------------------------------------------------------------------
// IMO lookup result types
// ---------------------------------------------------------------------------

type ImoLookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'exists'; id: string; name: string }
  | { status: 'prefilled'; vesselName: string }
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
  const [flagSearch, setFlagSearch] = useState('');
  const [imoLookup, setImoLookup] = useState<ImoLookupState>({ status: 'idle' });

  const form = useForm<QuickShipInput>({
    resolver: zodResolver(QuickShipSchema),
    defaultValues: { name: '', abbreviation: '', imoNumber: '', callSign: '', flagId: '' },
  });

  const { register, handleSubmit, control, formState, reset, watch, setValue } = form;

  const imoValue = watch('imoNumber');
  const isValidImo = typeof imoValue === 'string' && /^\d{7}$/.test(imoValue);

  // Reset lookup state when IMO changes
  useEffect(() => {
    setImoLookup({ status: 'idle' });
  }, [imoValue]);

  // Reset everything when modal closes
  useEffect(() => {
    if (!opened) {
      reset();
      setFlagSearch('');
      setImoLookup({ status: 'idle' });
    }
  }, [opened, reset]);

  async function handleImoLookup() {
    if (!isValidImo || !imoValue) return;
    setImoLookup({ status: 'loading' });

    // 1. Check our DB first
    const existing = await shipParticularsApi.getByImo(imoValue);
    if (existing !== null) {
      setImoLookup({ status: 'exists', id: existing.id, name: existing.name });
      return;
    }

    // 2. Not in DB — try Datalastic
    try {
      const res = await apiRequest<{ data: VesselInfo }>(`/datalastic/vessel_info?imo=${imoValue}`);
      const info = res.data;

      // Resolve flag from country_iso
      let resolvedFlagId = '';
      if (info.country_iso) {
        try {
          const flags = await flagsApi.list({ q: info.country_iso, limit: 10 });
          const match = flags.items.find(
            (f) => f.abbreviation?.toUpperCase() === info.country_iso.toUpperCase(),
          );
          if (match) resolvedFlagId = match.id;
        } catch {
          // flag lookup failure is non-fatal
        }
      }

      // Pre-fill form
      setValue('name', info.name ?? '', { shouldDirty: true });
      setValue('callSign', cleanCallSign(info.callsign), { shouldDirty: true });
      if (resolvedFlagId) setValue('flagId', resolvedFlagId, { shouldDirty: true });

      setImoLookup({ status: 'prefilled', vesselName: info.name ?? imoValue });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setImoLookup({ status: 'not_found' });
      } else if (err instanceof ApiError && err.status === 503) {
        setImoLookup({ status: 'error', message: 'Datalastic API key not configured on server.' });
      } else {
        setImoLookup({ status: 'error', message: 'Could not reach Datalastic right now.' });
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
      if (data.abbreviation) payload.abbreviation = data.abbreviation;
      if (data.imoNumber) payload.imoNumber = data.imoNumber;
      if (data.callSign) payload.callSign = data.callSign;
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
                Found <strong>{imoLookup.vesselName}</strong> in Datalastic. Name, call sign, and
                flag have been pre-filled below — review and click <strong>Create Ship</strong>.
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
                required
                value={field.value || null}
                onChange={(val) => field.onChange(val ?? '')}
                searchValue={flagSearch}
                onSearchChange={setFlagSearch}
                error={fieldState.error?.message}
              />
            )}
          />

          <TextInput
            label="Abbreviation"
            placeholder="e.g. ALVDR"
            error={formState.errors.abbreviation?.message}
            {...register('abbreviation')}
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
