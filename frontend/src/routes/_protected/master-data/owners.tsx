import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Alert, Stack, TextInput, Textarea } from '@mantine/core';
import { OwnerCreateSchema } from '@portlog/schemas';
import type { OwnerCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useOwners,
  useSaveOwner,
  useDeleteOwner,
  ownersApi,
} from '../../../lib/api/master-data/owners';
import { useCurrentUser } from '../../../lib/auth/queries';

export const Route = createFileRoute('/_protected/master-data/owners')({
  component: OwnersScreen,
});

function OwnersScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useOwners();
  const saveOwner = useSaveOwner(selectedId);
  const deleteOwner = useDeleteOwner();
  const { data: currentUser } = useCurrentUser();

  const hasFinancialPermission = currentUser?.permissions?.includes('owner.financial') ?? false;

  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((o): ListItem => ({ id: o.id, label: o.nombre })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<OwnerCreateInput> => {
    const owner = await ownersApi.get(id);
    return {
      nombre: owner.nombre,
      listadoContacto: owner.listadoContacto ?? undefined,
      cantidad: owner.cantidad ?? undefined,
      numeroContacto: owner.numeroContacto ?? undefined,
      direccionFisica: owner.direccionFisica ?? undefined,
      telefonos: owner.telefonos ?? undefined,
      direccion: owner.direccion ?? undefined,
      cargo: owner.cargo ?? undefined,
      redesSociales: owner.redesSociales ?? undefined,
      comentarios: owner.comentarios ?? undefined,
      cumpleanos: owner.cumpleanos ?? undefined,
      gustos: owner.gustos ?? undefined,
      recomendaciones: owner.recomendaciones ?? undefined,
      business: owner.business ?? undefined,
      webpage: owner.webpage ?? undefined,
      acuerdos: owner.acuerdos ?? undefined,
      historyJson: owner.historyJson ?? undefined,
      comments: owner.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: OwnerCreateInput) => {
      await saveOwner.mutateAsync(values);
    },
    [saveOwner],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteOwner.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteOwner],
  );

  const searchFn = useCallback(async (q: string) => {
    return ownersApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="owners"
      schema={OwnerCreateSchema}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
    >
      {(form) => <OwnerFields form={form} hasFinancialPermission={hasFinancialPermission} />}
    </MasterDetailShell>
  );
}

function OwnerFields({
  form,
  hasFinancialPermission,
}: {
  form: ReturnType<typeof import('react-hook-form').useForm<OwnerCreateInput>>;
  hasFinancialPermission: boolean;
}) {
  return (
    <Stack gap="sm">
      {/* Personal block */}
      <TextInput
        label="Nombre"
        placeholder="e.g. Armadores del Pacífico SA"
        required
        error={form.formState.errors.nombre?.message}
        {...form.register('nombre')}
      />
      <TextInput
        label="Dirección Física"
        placeholder="Dirección física"
        error={form.formState.errors.direccionFisica?.message}
        {...form.register('direccionFisica')}
      />
      <TextInput
        label="Dirección (correspondencia)"
        placeholder="Dirección postal"
        error={form.formState.errors.direccion?.message}
        {...form.register('direccion')}
      />
      <TextInput
        label="Teléfonos"
        placeholder="+1 555 0100"
        error={form.formState.errors.telefonos?.message}
        {...form.register('telefonos')}
      />
      <TextInput
        label="Número de Contacto"
        placeholder="Número de contacto principal"
        error={form.formState.errors.numeroContacto?.message}
        {...form.register('numeroContacto')}
      />
      <TextInput
        label="Listado de Contacto"
        placeholder="Listado de contacto"
        error={form.formState.errors.listadoContacto?.message}
        {...form.register('listadoContacto')}
      />

      {/* CRM block */}
      <TextInput
        label="Cumpleaños"
        placeholder="dd/mm/yyyy"
        error={form.formState.errors.cumpleanos?.message}
        {...form.register('cumpleanos')}
      />
      <Textarea
        label="Gustos"
        placeholder="Preferencias y gustos"
        autosize
        minRows={2}
        error={form.formState.errors.gustos?.message}
        {...form.register('gustos')}
      />
      <Textarea
        label="Recomendaciones"
        autosize
        minRows={2}
        error={form.formState.errors.recomendaciones?.message}
        {...form.register('recomendaciones')}
      />
      <Textarea
        label="Business"
        autosize
        minRows={2}
        error={form.formState.errors.business?.message}
        {...form.register('business')}
      />
      <TextInput
        label="Webpage"
        placeholder="https://example.com"
        error={form.formState.errors.webpage?.message}
        {...form.register('webpage')}
      />

      {/* Sensitive CRM — gated by owner.financial */}
      {hasFinancialPermission ? (
        <Textarea
          label="Acuerdos"
          placeholder="Acuerdos financieros"
          autosize
          minRows={3}
          error={form.formState.errors.acuerdos?.message}
          {...form.register('acuerdos')}
        />
      ) : (
        <Alert color="yellow" title="Acuerdos">
          Requires owner.financial permission to view or edit.
        </Alert>
      )}

      {/* History block — gated by owner.financial */}
      {hasFinancialPermission ? (
        <Textarea
          label="Historial (Buques / OTs / Factura / Pagos)"
          placeholder='{"buques": [], "ots": []}'
          autosize
          minRows={4}
          error={form.formState.errors.historyJson?.message as string | undefined}
          {...form.register('historyJson')}
        />
      ) : (
        <Alert color="yellow" title="Historial (Buques / OTs / Factura / Pagos)">
          Requires owner.financial permission to view or edit.
        </Alert>
      )}

      <Textarea
        label="Comentarios"
        placeholder="Comentarios internos"
        autosize
        minRows={2}
        error={form.formState.errors.comentarios?.message}
        {...form.register('comentarios')}
      />
      <Textarea
        label="Comments"
        placeholder="Internal notes"
        autosize
        minRows={2}
        error={form.formState.errors.comments?.message}
        {...form.register('comments')}
      />
    </Stack>
  );
}
