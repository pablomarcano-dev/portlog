import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Stack, TextInput, Textarea } from '@mantine/core';
import { SupplierCreateSchema } from '@portlog/schemas';
import type { SupplierCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useSuppliers,
  useSaveSupplier,
  useDeleteSupplier,
  suppliersApi,
} from '../../../lib/api/master-data/suppliers';

export const Route = createFileRoute('/_protected/master-data/suppliers')({
  component: SuppliersScreen,
});

function SuppliersScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useSuppliers();
  const saveSupplier = useSaveSupplier(selectedId);
  const deleteSupplier = useDeleteSupplier();

  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((s): ListItem => ({ id: s.id, label: s.name })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<SupplierCreateInput> => {
    const supplier = await suppliersApi.get(id);
    return {
      name: supplier.name,
      contactos: supplier.contactos ?? undefined,
      direccion: supplier.direccion ?? undefined,
      servicios: supplier.servicios ?? undefined,
      kyc: supplier.kyc ?? undefined,
      telefonos: supplier.telefonos ?? undefined,
      correosElectronicos: supplier.correosElectronicos ?? undefined,
      certificados: supplier.certificados ?? undefined,
      tarifas: supplier.tarifas ?? undefined,
      contratoDeServicios: supplier.contratoDeServicios ?? undefined,
      acuerdos: supplier.acuerdos ?? undefined,
      comments: supplier.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: SupplierCreateInput) => {
      await saveSupplier.mutateAsync(values);
    },
    [saveSupplier],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteSupplier.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteSupplier],
  );

  const searchFn = useCallback(async (q: string) => {
    return suppliersApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="suppliers"
      schema={SupplierCreateSchema}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
    >
      {(form) => <SupplierFields form={form} />}
    </MasterDetailShell>
  );
}

function SupplierFields({
  form,
}: {
  form: ReturnType<typeof import('react-hook-form').useForm<SupplierCreateInput>>;
}) {
  return (
    <Stack gap="sm">
      <TextInput
        label="Name"
        placeholder="e.g. Acme Port Services S.A."
        required
        error={form.formState.errors.name?.message}
        {...form.register('name')}
      />
      <TextInput
        label="Address / Dirección"
        placeholder="Full mailing address"
        error={form.formState.errors.direccion?.message}
        {...form.register('direccion')}
      />
      <Textarea
        label="Services / Servicios"
        placeholder="Types of services provided"
        autosize
        minRows={3}
        error={form.formState.errors.servicios?.message}
        {...form.register('servicios')}
      />
      <Textarea
        label="KYC"
        placeholder="Know-your-customer notes"
        autosize
        minRows={3}
        error={form.formState.errors.kyc?.message}
        {...form.register('kyc')}
      />
      <TextInput
        label="Phones / Teléfonos"
        placeholder="e.g. +1 555 0100, +1 555 0101"
        error={form.formState.errors.telefonos?.message}
        {...form.register('telefonos')}
      />
      <TextInput
        label="Emails / Correos Electrónicos"
        placeholder="e.g. ops@acme.com, billing@acme.com"
        error={form.formState.errors.correosElectronicos?.message}
        {...form.register('correosElectronicos')}
      />
      <Textarea
        label="Certificates / Certificados"
        placeholder="Certifications and compliance documents"
        autosize
        minRows={3}
        error={form.formState.errors.certificados?.message}
        {...form.register('certificados')}
      />
      <Textarea
        label="Rates / Tarifas"
        placeholder="Rate schedules and pricing"
        autosize
        minRows={3}
        error={form.formState.errors.tarifas?.message}
        {...form.register('tarifas')}
      />
      <Textarea
        label="Service Contract / Contrato de Servicios"
        placeholder="Contract terms and references"
        autosize
        minRows={3}
        error={form.formState.errors.contratoDeServicios?.message}
        {...form.register('contratoDeServicios')}
      />
      <Textarea
        label="Agreements / Acuerdos"
        placeholder="Side agreements and MOUs"
        autosize
        minRows={3}
        error={form.formState.errors.acuerdos?.message}
        {...form.register('acuerdos')}
      />
      <Textarea
        label="Contacts / Contactos"
        placeholder="Key contacts and roles"
        autosize
        minRows={3}
        error={form.formState.errors.contactos?.message}
        {...form.register('contactos')}
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
