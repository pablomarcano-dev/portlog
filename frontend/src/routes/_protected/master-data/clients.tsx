import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Stack, TextInput, Textarea, Group, Button, Table, Text, Box } from '@mantine/core';
import { ClientCreateSchema } from '@portlog/schemas';
import type { ClientCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useClients,
  useSaveClient,
  useDeleteClient,
  clientsApi,
} from '../../../lib/api/master-data/clients';

export const Route = createFileRoute('/_protected/master-data/clients')({
  component: ClientsScreen,
});

interface TariffRow {
  item: string;
  amount: string;
  information: string;
}

function parseTariff(raw: string | null | undefined): TariffRow[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as TariffRow[];
  } catch {
    // ignore
  }
  return [];
}

function ClientsScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useClients();
  const saveClient = useSaveClient(selectedId);
  const deleteClient = useDeleteClient();

  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((c): ListItem => ({ id: c.id, label: c.name })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<ClientCreateInput> => {
    const client = await clientsApi.get(id);
    return {
      name: client.name,
      phone: client.phone ?? undefined,
      phone2: client.phone2 ?? undefined,
      physicalAddress: client.physicalAddress ?? undefined,
      billingAddress: client.billingAddress ?? undefined,
      postalAddress: client.postalAddress ?? undefined,
      taxAddress: client.taxAddress ?? undefined,
      otherAddress: client.otherAddress ?? undefined,
      fax: client.fax ?? undefined,
      mobile: client.mobile ?? undefined,
      email: client.email ?? undefined,
      emailGroup: client.emailGroup ?? undefined,
      tariff: client.tariff ?? undefined,
      instructions: client.instructions ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: ClientCreateInput) => {
      await saveClient.mutateAsync(values);
    },
    [saveClient],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteClient.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteClient],
  );

  const searchFn = useCallback(async (q: string) => {
    return clientsApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="clients"
      schema={ClientCreateSchema}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
    >
      {(form) => <ClientFields form={form} />}
    </MasterDetailShell>
  );
}

function ClientFields({
  form,
}: {
  form: ReturnType<typeof import('react-hook-form').useForm<ClientCreateInput>>;
}) {
  const physicalAddress = form.watch('physicalAddress');

  const copyPhysical = (field: keyof ClientCreateInput) => {
    form.setValue(field, physicalAddress ?? '');
  };

  const tariffRaw = form.watch('tariff');
  const tariffRows = parseTariff(tariffRaw);

  const setTariff = (rows: TariffRow[]) => {
    form.setValue('tariff', JSON.stringify(rows));
  };

  const addTariffRow = () => {
    setTariff([...tariffRows, { item: '', amount: '', information: '' }]);
  };

  const removeTariffRow = (idx: number) => {
    setTariff(tariffRows.filter((_, i) => i !== idx));
  };

  const updateTariffCell = (idx: number, field: keyof TariffRow, value: string) => {
    const updated = tariffRows.map((row, i) => (i === idx ? { ...row, [field]: value } : row));
    setTariff(updated);
  };

  return (
    <Stack gap="sm">
      {/* Basic info row */}
      <Group align="flex-start" grow>
        <TextInput
          label="Name"
          placeholder="Client name"
          required
          error={form.formState.errors.name?.message}
          {...form.register('name')}
        />
        <TextInput
          label="Tel."
          placeholder="+1 555 0100"
          error={form.formState.errors.phone?.message}
          {...form.register('phone')}
        />
        <TextInput
          label="Tel. 2"
          placeholder="+1 555 0101"
          error={form.formState.errors.phone2?.message}
          {...form.register('phone2')}
        />
      </Group>

      {/* Physical address */}
      <TextInput
        label="Physical Address"
        placeholder="Physical address"
        error={form.formState.errors.physicalAddress?.message}
        {...form.register('physicalAddress')}
      />

      {/* Address fields with Copy Physical buttons */}
      <Group align="flex-end" gap="xs">
        <TextInput
          style={{ flex: 1 }}
          label="Billing Address"
          placeholder="Billing address"
          error={form.formState.errors.billingAddress?.message}
          {...form.register('billingAddress')}
        />
        <Button variant="filled" size="xs" mb={2} onClick={() => copyPhysical('billingAddress')}>
          Copy Physical
        </Button>
      </Group>

      <Group align="flex-end" gap="xs">
        <TextInput
          style={{ flex: 1 }}
          label="Postal Address"
          placeholder="Postal address"
          error={form.formState.errors.postalAddress?.message}
          {...form.register('postalAddress')}
        />
        <Button variant="filled" size="xs" mb={2} onClick={() => copyPhysical('postalAddress')}>
          Copy Physical
        </Button>
      </Group>

      <Group align="flex-end" gap="xs">
        <TextInput
          style={{ flex: 1 }}
          label="Tax Address"
          placeholder="Tax address"
          error={form.formState.errors.taxAddress?.message}
          {...form.register('taxAddress')}
        />
        <Button variant="filled" size="xs" mb={2} onClick={() => copyPhysical('taxAddress')}>
          Copy Physical
        </Button>
      </Group>

      <Group align="flex-end" gap="xs">
        <TextInput
          style={{ flex: 1 }}
          label="Other Address"
          placeholder="Other address"
          error={form.formState.errors.otherAddress?.message}
          {...form.register('otherAddress')}
        />
        <Button variant="filled" size="xs" mb={2} onClick={() => copyPhysical('otherAddress')}>
          Copy Physical
        </Button>
      </Group>

      {/* Contact info row */}
      <Group align="flex-start" grow>
        <TextInput
          label="Fax"
          placeholder="Fax number"
          error={form.formState.errors.fax?.message}
          {...form.register('fax')}
        />
        <TextInput
          label="Mobile"
          placeholder="Mobile number"
          error={form.formState.errors.mobile?.message}
          {...form.register('mobile')}
        />
        <TextInput
          label="EMail"
          placeholder="email@example.com"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <TextInput
          label="EMail Group"
          placeholder="Email group"
          error={form.formState.errors.emailGroup?.message}
          {...form.register('emailGroup')}
        />
      </Group>

      {/* Client Tariff table */}
      <Box>
        <Group justify="space-between" mb="xs">
          <Text fw={600} size="sm" c="blue.7">
            Client Tariff
          </Text>
          <Button size="xs" variant="outline" onClick={addTariffRow}>
            Insert new row
          </Button>
        </Group>
        <Table withTableBorder withColumnBorders fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40}>#</Table.Th>
              <Table.Th>Item</Table.Th>
              <Table.Th w={120}>Amount</Table.Th>
              <Table.Th>Information</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tariffRows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" size="xs" py="sm">
                    No tariff rows. Click &quot;Insert new row&quot; to add one.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              tariffRows.map((row, idx) => (
                <Table.Tr key={idx}>
                  <Table.Td>{idx + 1}</Table.Td>
                  <Table.Td>
                    <TextInput
                      size="xs"
                      variant="unstyled"
                      value={row.item}
                      onChange={(e) => updateTariffCell(idx, 'item', e.currentTarget.value)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      size="xs"
                      variant="unstyled"
                      value={row.amount}
                      onChange={(e) => updateTariffCell(idx, 'amount', e.currentTarget.value)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      size="xs"
                      variant="unstyled"
                      value={row.information}
                      onChange={(e) => updateTariffCell(idx, 'information', e.currentTarget.value)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Button
                      variant="subtle"
                      color="red"
                      size="compact-xs"
                      onClick={() => removeTariffRow(idx)}
                    >
                      ×
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Box>

      {/* Instructions */}
      <Textarea
        label="Instructions"
        placeholder="Special instructions for this client"
        autosize
        minRows={4}
        error={form.formState.errors.instructions?.message}
        {...form.register('instructions')}
      />
    </Stack>
  );
}
