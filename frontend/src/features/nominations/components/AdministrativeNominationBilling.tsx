import { useState } from 'react';
import { Alert, Button, Fieldset, Group, Select, Stack, Text } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import {
  AdministrativeBillingSelectionSchema,
  type AdministrativeBillingCategory,
  type AdministrativeBillingRecipient,
  type AdministrativeBillingRecipients,
  type AdministrativeBillingSelection,
} from '@portlog/schemas';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import { apiRequest } from '../../../lib/api/client';
import { ApiError } from '../../../lib/api/errors';
import { clientQueryOptions } from '../../../lib/api/master-data/clients';

const billingCategories = {
  PORT_COSTS: 'Costos portuarios a facturar',
  OWNER_EXPENSES: 'Gastos del armador a facturar',
  TECHNICAL_MANAGEMENT: 'Costos de gestión técnica a facturar',
} satisfies Record<AdministrativeBillingCategory, string>;

const addressPurposeLabels = { TAX: 'Fiscal', BILLING: 'Facturación' };
const emptySelection: AdministrativeBillingSelection = {
  clientId: '',
  addressPurpose: 'TAX',
  addressText: '',
};

function billingPath(nominationId: string) {
  return `/nominations/${nominationId}/administrative-billing`;
}

export function administrativeBillingQueryKey(nominationId: string) {
  return ['nominations', nominationId, 'administrative-billing'] as const;
}

interface AdministrativeNominationBillingProps {
  nominationId: string;
  disabled?: boolean;
}

interface BillingRecipientFieldProps {
  nominationId: string;
  category: AdministrativeBillingCategory;
  saved: AdministrativeBillingRecipient | null;
  disabled: boolean;
}

function BillingRecipientField({
  nominationId,
  category,
  saved,
  disabled,
}: BillingRecipientFieldProps) {
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState('');
  const form = useForm<AdministrativeBillingSelection>({
    resolver: zodResolver(AdministrativeBillingSelectionSchema),
    defaultValues: emptySelection,
  });
  const selection = useWatch({ control: form.control });
  const clientDetails = useQuery({
    ...clientQueryOptions(selection.clientId ?? ''),
    enabled: editing && !!selection.clientId,
  });
  const addresses = (clientDetails.data?.addresses ?? []).flatMap(({ purpose, text, label }) => {
    if (purpose !== 'BILLING' && purpose !== 'TAX') return [];
    return [{ addressPurpose: purpose, addressText: text, label }];
  });
  const selectedAddress = addresses.find(
    (item) =>
      item.addressPurpose === selection.addressPurpose &&
      item.addressText === selection.addressText,
  );
  const queryClient = useQueryClient();
  const queryKey = administrativeBillingQueryKey(nominationId);
  const save = useMutation({
    mutationKey: queryKey,
    mutationFn: async (selection: AdministrativeBillingSelection | null) => {
      await queryClient.cancelQueries({ queryKey });
      const { recipient } = await apiRequest<{ recipient: AdministrativeBillingRecipient | null }>(
        `${billingPath(nominationId)}/${category}`,
        { method: 'PUT', body: JSON.stringify({ selection }) },
      );
      return recipient;
    },
    onSuccess: async (recipient) => {
      queryClient.setQueryData<AdministrativeBillingRecipients>(queryKey, (current) =>
        current ? { ...current, [category]: recipient } : current,
      );
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error, selection) => {
      if (selection && error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({
          queryKey: clientQueryOptions(selection.clientId).queryKey,
        });
      }
    },
  });

  function edit() {
    save.reset();
    setEditing(true);
    setSearch('');
    form.reset(
      saved
        ? {
            clientId: saved.clientId,
            addressPurpose: saved.addressPurpose,
            addressText: saved.addressText,
          }
        : emptySelection,
    );
  }

  return (
    <Fieldset legend={billingCategories[category]}>
      <Stack gap="xs">
        {saved ? (
          <div>
            <Text size="sm" fw={600}>
              {saved.clientName}
            </Text>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {saved.addressText}
            </Text>
          </div>
        ) : (
          <Text size="sm" c="dimmed">
            Sin destinatario de facturación.
          </Text>
        )}
        {editing && !disabled ? (
          <Stack
            component="form"
            gap="xs"
            onSubmit={(event) => {
              event.preventDefault();
              if (selectedAddress && !save.isPending) {
                void form.handleSubmit((values) => save.mutate(values))(event);
              }
            }}
          >
            <EntityPicker
              endpoint="/master-data/clients"
              label="Cuenta a facturar"
              placeholder="Buscar clientes"
              value={selection.clientId || null}
              selectedOption={saved && { value: saved.clientId, label: saved.clientName }}
              searchValue={search}
              onSearchChange={setSearch}
              onChange={(id) => {
                form.reset({ ...emptySelection, clientId: id ?? '' });
                save.reset();
              }}
              error={form.formState.errors.clientId?.message}
              disabled={save.isPending}
            />
            {selection.clientId && (
              <Select
                label="Dirección fiscal o de facturación"
                placeholder="Seleccionar una dirección"
                value={selectedAddress?.addressPurpose ?? null}
                data={addresses.map((item) => ({
                  value: item.addressPurpose,
                  label: `${item.label || addressPurposeLabels[item.addressPurpose]} · ${item.addressText}`,
                }))}
                onChange={(purpose) => {
                  const address = addresses.find((item) => item.addressPurpose === purpose);
                  form.setValue(
                    'addressPurpose',
                    address?.addressPurpose ?? emptySelection.addressPurpose,
                  );
                  form.setValue('addressText', address?.addressText ?? '');
                }}
                error={form.formState.errors.addressText?.message}
                disabled={save.isPending || addresses.length === 0}
                description={
                  clientDetails.isPending
                    ? 'Cargando direcciones…'
                    : clientDetails.isError
                      ? 'No se pudieron cargar las direcciones de esta cuenta.'
                      : addresses.length === 0
                        ? 'Agrega una dirección fiscal o de facturación en la ficha del cliente.'
                        : undefined
                }
              />
            )}
            <Group gap="xs">
              <Button size="xs" type="submit" disabled={!selectedAddress} loading={save.isPending}>
                Guardar destinatario
              </Button>
              <Button
                size="xs"
                variant="default"
                onClick={() => {
                  setEditing(false);
                  save.reset();
                }}
                disabled={save.isPending}
              >
                Cancelar
              </Button>
            </Group>
          </Stack>
        ) : (
          !disabled && (
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={edit} disabled={save.isPending}>
                {saved ? 'Cambiar destinatario' : 'Seleccionar destinatario'}
              </Button>
              {saved && (
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => save.mutate(null)}
                  loading={save.isPending}
                >
                  Quitar destinatario
                </Button>
              )}
            </Group>
          )
        )}
        {save.isError && (
          <Alert color="red" p="xs" role="alert">
            {save.error instanceof ApiError && save.error.status === 409
              ? 'No se pudo guardar el destinatario. Recarga la nominación o selecciona la dirección vigente.'
              : 'No se pudo guardar el destinatario. Intenta de nuevo.'}
          </Alert>
        )}
      </Stack>
    </Fieldset>
  );
}

export function AdministrativeNominationBilling({
  nominationId,
  disabled = false,
}: AdministrativeNominationBillingProps) {
  const billing = useQuery({
    queryKey: administrativeBillingQueryKey(nominationId),
    queryFn: () => apiRequest<AdministrativeBillingRecipients>(billingPath(nominationId)),
    staleTime: 30_000,
  });

  if (billing.isPending)
    return (
      <Text size="sm" c="dimmed">
        Cargando destinatarios…
      </Text>
    );
  if (!billing.data) {
    return (
      <Alert color="red" title="No se pudieron cargar los destinatarios">
        <Button size="xs" variant="light" onClick={() => void billing.refetch()}>
          Reintentar
        </Button>
      </Alert>
    );
  }

  return (
    <Stack gap="xs">
      {(Object.keys(billingCategories) as AdministrativeBillingCategory[]).map((category) => (
        <BillingRecipientField
          key={`${nominationId}:${category}`}
          nominationId={nominationId}
          category={category}
          saved={billing.data[category]}
          disabled={disabled}
        />
      ))}
    </Stack>
  );
}
