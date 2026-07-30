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
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SaleCreateSchema } from '@portlog/schemas';
import type { SaleCreate, SaleRead, SaleUpdate } from '@portlog/schemas';
import { useColumnResize } from '../../../components/table/useColumnResize';
import { ResizableTh } from '../../../components/table/ResizableTh';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import { NewClientModal } from './NewClientModal';
import { NewSalesContactModal } from './NewSalesContactModal';
import {
  useNominationSales,
  useAddSale,
  useUpdateSale,
  useRemoveSale,
} from '../hooks/useNominationSales';

/**
 * Columns follow the paper service voucher's own order: N° DE SERVICIO,
 * A CUENTA DE, SERVICIO RECORRIDO, PUERTO, COSTO DEL SERVICIO Bs.,
 * FECHA + HORA INICIO/FINAL, DESCRIPCION, CONDUCTOR, USUARIO.
 */
type SaleColKey =
  | 'serviceNo'
  | 'client'
  | 'service'
  | 'route'
  | 'port'
  | 'price'
  | 'startAt'
  | 'endAt'
  | 'description'
  | 'driver'
  | 'user'
  | 'actions';

const INITIAL_WIDTHS: Record<SaleColKey, number> = {
  serviceNo: 110,
  client: 170,
  service: 160,
  route: 180,
  port: 150,
  price: 110,
  startAt: 165,
  endAt: 165,
  description: 220,
  driver: 170,
  user: 170,
  actions: 60,
};

/** Empty text inputs clear the column rather than storing an empty string. */
function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

interface SaleRowProps {
  sale: SaleRead;
  isBusy: boolean;
  colWidths: Record<SaleColKey, number>;
  onUpdate: (saleId: string, data: SaleUpdate) => void;
  onRemove: (saleId: string) => void;
}

/**
 * Client and Service are shown read-only (change them by removing and re-adding
 * the sale); every other voucher field is inline-editable, including Port,
 * which is often only known once the service has actually run.
 */
function SaleRow({ sale, isBusy, colWidths, onUpdate, onRemove }: SaleRowProps) {
  const [portSearch, setPortSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  /** Commits a text field on blur, but only when the value actually changed. */
  function commitText(field: 'serviceNo' | 'route' | 'description') {
    return (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = nullIfBlank(e.currentTarget.value);
      if (next !== (sale[field] ?? null)) {
        onUpdate(sale.id, { [field]: next });
      }
    };
  }

  return (
    <Table.Tr>
      <Table.Td style={{ width: colWidths.serviceNo }}>
        <TextInput
          size="xs"
          defaultValue={sale.serviceNo ?? ''}
          disabled={isBusy}
          onBlur={commitText('serviceNo')}
        />
      </Table.Td>
      <Table.Td style={{ width: colWidths.client }}>
        <Text size="sm">{sale.client.name}</Text>
      </Table.Td>
      <Table.Td style={{ width: colWidths.service }}>
        <Text size="sm">{sale.service.name}</Text>
      </Table.Td>
      <Table.Td style={{ width: colWidths.route }}>
        <TextInput
          size="xs"
          defaultValue={sale.route ?? ''}
          disabled={isBusy}
          onBlur={commitText('route')}
        />
      </Table.Td>
      <Table.Td style={{ width: colWidths.port }}>
        <EntityPicker
          endpoint="/master-data/ports"
          label=""
          value={sale.portId ?? null}
          onChange={(val) => {
            if (val !== (sale.portId ?? null)) {
              onUpdate(sale.id, { portId: val });
            }
          }}
          searchValue={portSearch}
          onSearchChange={setPortSearch}
          disabled={isBusy}
        />
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
      <Table.Td style={{ width: colWidths.startAt }}>
        <DateTimePicker
          size="xs"
          valueFormat="DD/MM/YYYY HH:mm"
          value={sale.startAt}
          disabled={isBusy}
          onChange={(val) => {
            if (val !== null && val.getTime() !== sale.startAt.getTime()) {
              onUpdate(sale.id, { startAt: val });
            }
          }}
        />
      </Table.Td>
      <Table.Td style={{ width: colWidths.endAt }}>
        <DateTimePicker
          size="xs"
          valueFormat="DD/MM/YYYY HH:mm"
          clearable
          placeholder="In progress"
          value={sale.endAt ?? null}
          disabled={isBusy}
          onChange={(val) => {
            if ((val?.getTime() ?? null) !== (sale.endAt?.getTime() ?? null)) {
              onUpdate(sale.id, { endAt: val });
            }
          }}
        />
      </Table.Td>
      <Table.Td style={{ width: colWidths.description }}>
        <TextInput
          size="xs"
          defaultValue={sale.description ?? ''}
          disabled={isBusy}
          onBlur={commitText('description')}
        />
      </Table.Td>
      <Table.Td style={{ width: colWidths.driver }}>
        <EntityPicker
          endpoint="/master-data/sales-contacts"
          label=""
          value={sale.driverId ?? null}
          onChange={(val) => {
            if (val !== (sale.driverId ?? null)) {
              onUpdate(sale.id, { driverId: val });
            }
          }}
          searchValue={driverSearch}
          onSearchChange={setDriverSearch}
          disabled={isBusy}
        />
      </Table.Td>
      <Table.Td style={{ width: colWidths.user }}>
        <EntityPicker
          endpoint="/master-data/sales-contacts"
          label=""
          value={sale.userId ?? null}
          onChange={(val) => {
            if (val !== (sale.userId ?? null)) {
              onUpdate(sale.id, { userId: val });
            }
          }}
          searchValue={userSearch}
          onSearchChange={setUserSearch}
          disabled={isBusy}
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

/** A fresh voucher starts now, with no end time — the service has not finished yet. */
function blankSale(): Partial<SaleCreate> {
  return { startAt: new Date(), endAt: null, description: '' };
}

export function SalesModal({ opened, onClose, nominationId, correlative }: SalesModalProps) {
  const { data: sales, isLoading } = useNominationSales(nominationId, opened);
  const addSale = useAddSale(nominationId);
  const updateSale = useUpdateSale(nominationId);
  const removeSale = useRemoveSale(nominationId);

  const [addFormOpen, setAddFormOpen] = useState(false);
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  /** Which voucher line the inline sales-contact modal is filling, if any. */
  const [newContactFor, setNewContactFor] = useState<'driver' | 'user' | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [portSearch, setPortSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const busyId = useRef<string | null>(null);
  const [, setTick] = useState(0);

  const form = useForm<SaleCreate>({
    resolver: zodResolver(SaleCreateSchema),
    defaultValues: blankSale(),
  });
  const { control, register, handleSubmit, formState, reset, setValue } = form;

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
    // Untouched text inputs submit '' — store NULL instead, so "no N° de servicio
    // recorded" stays distinguishable from "recorded as blank" in queries.
    const payload: SaleCreate = {
      ...values,
      serviceNo: nullIfBlank(values.serviceNo ?? ''),
      route: nullIfBlank(values.route ?? ''),
      description: nullIfBlank(values.description ?? ''),
    };
    addSale.mutate(payload, {
      onSuccess: () => {
        reset(blankSale());
        setAddFormOpen(false);
      },
    });
  }

  function handleCancelAdd() {
    reset(blankSale());
    setAddFormOpen(false);
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Sales — Nomination #${correlative}`}
      size="90vw"
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
          <Table.ScrollContainer minWidth={1600}>
            <Table striped withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
              <Table.Thead>
                <Table.Tr>
                  <ResizableTh
                    width={colWidths.serviceNo}
                    onResize={(e) => startResize('serviceNo', e)}
                  >
                    Service N°
                  </ResizableTh>
                  <ResizableTh width={colWidths.client} onResize={(e) => startResize('client', e)}>
                    Client
                  </ResizableTh>
                  <ResizableTh
                    width={colWidths.service}
                    onResize={(e) => startResize('service', e)}
                  >
                    Service
                  </ResizableTh>
                  <ResizableTh width={colWidths.route} onResize={(e) => startResize('route', e)}>
                    Route
                  </ResizableTh>
                  <ResizableTh width={colWidths.port} onResize={(e) => startResize('port', e)}>
                    Port
                  </ResizableTh>
                  <ResizableTh width={colWidths.price} onResize={(e) => startResize('price', e)}>
                    Cost (Bs.)
                  </ResizableTh>
                  <ResizableTh
                    width={colWidths.startAt}
                    onResize={(e) => startResize('startAt', e)}
                  >
                    Start
                  </ResizableTh>
                  <ResizableTh width={colWidths.endAt} onResize={(e) => startResize('endAt', e)}>
                    End
                  </ResizableTh>
                  <ResizableTh
                    width={colWidths.description}
                    onResize={(e) => startResize('description', e)}
                  >
                    Description
                  </ResizableTh>
                  <ResizableTh width={colWidths.driver} onResize={(e) => startResize('driver', e)}>
                    Driver
                  </ResizableTh>
                  <ResizableTh width={colWidths.user} onResize={(e) => startResize('user', e)}>
                    User
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
          </Table.ScrollContainer>
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
                {/* N° DE SERVICIO + A CUENTA DE */}
                <Group grow align="flex-start">
                  <TextInput
                    label="Service N°"
                    placeholder="From the voucher"
                    error={formState.errors.serviceNo?.message}
                    {...register('serviceNo')}
                  />
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
                </Group>

                {/* SERVICIO + SERVICIO RECORRIDO + PUERTO */}
                <Group grow align="flex-start">
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
                  <TextInput
                    label="Route"
                    placeholder="e.g. Guaraguao - Muelle 3"
                    error={formState.errors.route?.message}
                    {...register('route')}
                  />
                  <Controller
                    name="portId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint="/master-data/ports"
                        label="Port"
                        value={field.value ?? null}
                        onChange={field.onChange}
                        searchValue={portSearch}
                        onSearchChange={setPortSearch}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </Group>

                {/* COSTO + FECHA/HORA INICIO + HORA FINAL */}
                <Group grow align="flex-start">
                  <Controller
                    name="price"
                    control={control}
                    render={({ field, fieldState }) => (
                      <NumberInput
                        label="Cost (Bs.)"
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
                    name="startAt"
                    control={control}
                    render={({ field, fieldState }) => (
                      <DateTimePicker
                        label="Start"
                        placeholder="Select date and time"
                        valueFormat="DD/MM/YYYY HH:mm"
                        required
                        value={field.value instanceof Date ? field.value : null}
                        onChange={(val) => field.onChange(val)}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    name="endAt"
                    control={control}
                    render={({ field, fieldState }) => (
                      <DateTimePicker
                        label="End"
                        description="Leave empty while the service is still running"
                        placeholder="In progress"
                        valueFormat="DD/MM/YYYY HH:mm"
                        clearable
                        value={field.value instanceof Date ? field.value : null}
                        onChange={(val) => field.onChange(val)}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </Group>

                {/* DESCRIPCION */}
                <Textarea
                  label="Description"
                  placeholder="What the service covered"
                  autosize
                  minRows={2}
                  error={formState.errors.description?.message}
                  {...register('description')}
                />

                {/* CONDUCTOR + USUARIO — both from the shared Sales Contacts directory */}
                <Group grow align="flex-start">
                  <Group gap="xs" align="flex-end" wrap="nowrap">
                    <Controller
                      name="driverId"
                      control={control}
                      render={({ field, fieldState }) => (
                        <EntityPicker
                          endpoint="/master-data/sales-contacts"
                          label="Driver"
                          value={field.value ?? null}
                          onChange={field.onChange}
                          searchValue={driverSearch}
                          onSearchChange={setDriverSearch}
                          error={fieldState.error?.message}
                        />
                      )}
                    />
                    <Tooltip label="Create new sales contact">
                      <ActionIcon
                        variant="default"
                        size="lg"
                        onClick={() => setNewContactFor('driver')}
                        aria-label="Create new sales contact for driver"
                      >
                        +
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                  <Group gap="xs" align="flex-end" wrap="nowrap">
                    <Controller
                      name="userId"
                      control={control}
                      render={({ field, fieldState }) => (
                        <EntityPicker
                          endpoint="/master-data/sales-contacts"
                          label="User"
                          value={field.value ?? null}
                          onChange={field.onChange}
                          searchValue={userSearch}
                          onSearchChange={setUserSearch}
                          error={fieldState.error?.message}
                        />
                      )}
                    />
                    <Tooltip label="Create new sales contact">
                      <ActionIcon
                        variant="default"
                        size="lg"
                        onClick={() => setNewContactFor('user')}
                        aria-label="Create new sales contact for user"
                      >
                        +
                      </ActionIcon>
                    </Tooltip>
                  </Group>
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

      <NewSalesContactModal
        opened={newContactFor !== null}
        role={newContactFor === 'user' ? 'User' : 'Driver'}
        onClose={() => setNewContactFor(null)}
        onCreated={(id) => {
          setValue(newContactFor === 'user' ? 'userId' : 'driverId', id, {
            shouldValidate: true,
            shouldDirty: true,
          });
          setNewContactFor(null);
        }}
      />
    </Modal>
  );
}
