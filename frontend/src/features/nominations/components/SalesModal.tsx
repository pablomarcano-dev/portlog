import { useRef, useState } from 'react';
import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SaleCreateSchema } from '@portlog/schemas';
import type { SaleCreate, SaleRead, SaleUpdate } from '@portlog/schemas';
import { useColumnResize } from '../../../components/table/useColumnResize';
import { ResizableTh } from '../../../components/table/ResizableTh';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import { NewClientModal } from './NewClientModal';
import {
  useNominationSales,
  useAddSale,
  useUpdateSale,
  useRemoveSale,
} from '../hooks/useNominationSales';

type SaleColKey = 'client' | 'service' | 'price' | 'date' | 'notes' | 'actions';

interface SaleRowProps {
  sale: SaleRead;
  isBusy: boolean;
  colWidths: Record<SaleColKey, number>;
  onUpdate: (saleId: string, data: SaleUpdate) => void;
  onRemove: (saleId: string) => void;
}

/**
 * Client/Service are shown read-only (change them by removing and re-adding
 * the sale); price, date, and notes are inline-editable.
 */
function SaleRow({ sale, isBusy, colWidths, onUpdate, onRemove }: SaleRowProps) {
  return (
    <Table.Tr>
      <Table.Td style={{ width: colWidths.client }}>
        <Text size="sm">{sale.client.name}</Text>
      </Table.Td>
      <Table.Td style={{ width: colWidths.service }}>
        <Text size="sm">{sale.service.name}</Text>
      </Table.Td>
      <Table.Td style={{ width: colWidths.price }}>
        <NumberInput
          size="xs"
          hideControls
          min={0}
          decimalScale={2}
          defaultValue={sale.price}
          disabled={isBusy}
          onBlur={(e) => {
            const val = Number(e.currentTarget.value.replace(/,/g, ''));
            if (!Number.isNaN(val) && val >= 0 && val !== sale.price) {
              onUpdate(sale.id, { price: val });
            }
          }}
        />
      </Table.Td>
      <Table.Td style={{ width: colWidths.date }}>
        <DatePickerInput
          size="xs"
          valueFormat="DD/MM/YYYY"
          value={sale.date}
          disabled={isBusy}
          onChange={(val) => {
            if (val !== null && val.getTime() !== sale.date.getTime()) {
              onUpdate(sale.id, { date: val });
            }
          }}
        />
      </Table.Td>
      <Table.Td style={{ width: colWidths.notes }}>
        <TextInput
          size="xs"
          defaultValue={sale.notes ?? ''}
          disabled={isBusy}
          onBlur={(e) => {
            const val = e.currentTarget.value.trim();
            if (val !== (sale.notes ?? '')) {
              onUpdate(sale.id, { notes: val });
            }
          }}
        />
      </Table.Td>
      <Table.Td style={{ width: colWidths.actions }}>
        <Button
          size="compact-xs"
          color="red"
          variant="subtle"
          loading={isBusy}
          onClick={() => onRemove(sale.id)}
          aria-label="Remove sale"
        >
          x
        </Button>
      </Table.Td>
    </Table.Tr>
  );
}

interface SalesModalProps {
  opened: boolean;
  onClose: () => void;
  nominationId: string;
  correlative: number;
}

export function SalesModal({ opened, onClose, nominationId, correlative }: SalesModalProps) {
  const { data: sales, isLoading } = useNominationSales(nominationId, opened);
  const addSale = useAddSale(nominationId);
  const updateSale = useUpdateSale(nominationId);
  const removeSale = useRemoveSale(nominationId);

  const [addFormOpen, setAddFormOpen] = useState(false);
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  const busyId = useRef<string | null>(null);
  const [, setTick] = useState(0);

  const form = useForm<SaleCreate>({
    resolver: zodResolver(SaleCreateSchema),
    defaultValues: { date: new Date(), notes: '' },
  });
  const { control, register, handleSubmit, formState, reset, setValue } = form;

  const INITIAL_WIDTHS: Record<SaleColKey, number> = {
    client: 180,
    service: 180,
    price: 110,
    date: 130,
    notes: 200,
    actions: 60,
  };
  const { colWidths, startResize } = useColumnResize<SaleColKey>(INITIAL_WIDTHS);

  function handleUpdate(saleId: string, data: SaleUpdate) {
    busyId.current = saleId;
    setTick((t) => t + 1);
    updateSale.mutate(
      { saleId, data },
      {
        onSettled: () => {
          busyId.current = null;
          setTick((t) => t + 1);
        },
      },
    );
  }

  function handleRemove(saleId: string) {
    busyId.current = saleId;
    setTick((t) => t + 1);
    removeSale.mutate(saleId, {
      onSettled: () => {
        busyId.current = null;
        setTick((t) => t + 1);
      },
    });
  }

  function handleAdd(values: SaleCreate) {
    addSale.mutate(values, {
      onSuccess: () => {
        reset({ date: new Date(), notes: '' });
        setAddFormOpen(false);
      },
    });
  }

  function handleCancelAdd() {
    reset({ date: new Date(), notes: '' });
    setAddFormOpen(false);
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Sales — Nomination #${correlative}`}
      size="70vw"
      styles={{ content: { resize: 'both', overflow: 'auto' } }}
    >
      <Stack gap="sm">
        {isLoading && <Loader size="sm" />}

        {!isLoading && (sales == null || sales.length === 0) && (
          <Text size="sm" c="dimmed">
            No sales recorded yet.
          </Text>
        )}

        {sales != null && sales.length > 0 && (
          <Table striped withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
            <Table.Thead>
              <Table.Tr>
                <ResizableTh width={colWidths.client} onResize={(e) => startResize('client', e)}>
                  Client
                </ResizableTh>
                <ResizableTh width={colWidths.service} onResize={(e) => startResize('service', e)}>
                  Service
                </ResizableTh>
                <ResizableTh width={colWidths.price} onResize={(e) => startResize('price', e)}>
                  Price
                </ResizableTh>
                <ResizableTh width={colWidths.date} onResize={(e) => startResize('date', e)}>
                  Date
                </ResizableTh>
                <ResizableTh width={colWidths.notes} onResize={(e) => startResize('notes', e)}>
                  Notes
                </ResizableTh>
                <ResizableTh
                  width={colWidths.actions}
                  onResize={(e) => startResize('actions', e)}
                />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sales.map((sale) => (
                <SaleRow
                  key={sale.id}
                  sale={sale}
                  isBusy={busyId.current === sale.id}
                  colWidths={colWidths}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                />
              ))}
            </Table.Tbody>
          </Table>
        )}

        {!addFormOpen && (
          <Group>
            <Button variant="outline" size="xs" onClick={() => setAddFormOpen(true)}>
              + Add Sale
            </Button>
          </Group>
        )}

        {addFormOpen && (
          <>
            <Divider label="New Sale" labelPosition="left" />
            <form onSubmit={handleSubmit(handleAdd)} noValidate>
              <Stack gap="sm">
                <Group grow align="flex-start">
                  <Group gap="xs" align="flex-end" wrap="nowrap">
                    <Controller
                      name="clientId"
                      control={control}
                      render={({ field, fieldState }) => (
                        <EntityPicker
                          endpoint="/master-data/clients"
                          label="Client"
                          required
                          value={field.value ?? null}
                          onChange={field.onChange}
                          searchValue={clientSearch}
                          onSearchChange={setClientSearch}
                          error={fieldState.error?.message}
                        />
                      )}
                    />
                    <Tooltip label="Create new client">
                      <ActionIcon
                        variant="default"
                        size="lg"
                        onClick={() => setNewClientModalOpen(true)}
                        aria-label="Create new client"
                      >
                        +
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                  <Controller
                    name="serviceId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint="/master-data/services"
                        label="Service"
                        required
                        value={field.value ?? null}
                        onChange={field.onChange}
                        searchValue={serviceSearch}
                        onSearchChange={setServiceSearch}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </Group>
                <Group grow align="flex-start">
                  <Controller
                    name="price"
                    control={control}
                    render={({ field, fieldState }) => (
                      <NumberInput
                        label="Price"
                        placeholder="e.g. 1500.50"
                        required
                        hideControls
                        min={0}
                        decimalScale={2}
                        value={field.value ?? ''}
                        onChange={(val) => field.onChange(val === '' ? undefined : Number(val))}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    name="date"
                    control={control}
                    render={({ field, fieldState }) => (
                      <DatePickerInput
                        label="Date"
                        required
                        value={field.value instanceof Date ? field.value : null}
                        onChange={(val) => field.onChange(val)}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <TextInput
                    label="Notes"
                    placeholder="Optional remarks"
                    error={formState.errors.notes?.message}
                    {...register('notes')}
                  />
                </Group>
                <Group justify="flex-end">
                  <Button variant="default" onClick={handleCancelAdd} disabled={addSale.isPending}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={addSale.isPending}>
                    Add Sale
                  </Button>
                </Group>
              </Stack>
            </form>
          </>
        )}

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>

      <NewClientModal
        opened={newClientModalOpen}
        onClose={() => setNewClientModalOpen(false)}
        onCreated={(id) => {
          setValue('clientId', id, { shouldValidate: true, shouldDirty: true });
          setNewClientModalOpen(false);
        }}
      />
    </Modal>
  );
}
