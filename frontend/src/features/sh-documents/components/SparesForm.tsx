import { useState } from 'react';
import { Alert, Anchor, Button, Group, Loader, Stack, Table, Text, TextInput } from '@mantine/core';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { NumberInput } from '@mantine/core';
import type { SHDocumentDto, SHDocumentType } from '@portlog/schemas';
import {
  useCreateShDocument,
  useUpdateShDocument,
  useFinalizeShDocument,
  useGenerateShDocument,
  usePdfUrl,
} from '../api';
import { ShDocStatusBadge } from './ShDocStatusBadge';
import { SendShDocumentDrawer } from './SendShDocumentDrawer';
import { useColumnResize } from '../../../components/table/useColumnResize';
import { ResizableTh } from '../../../components/table/ResizableTh';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const rowSchema = z.object({
  description: z.string().min(1, 'Descripcion requerida'),
  qty: z.number().positive('Cantidad debe ser mayor que 0'),
  unit: z.string().optional(),
  weightKg: z.number().optional(),
});

const sparesSchema = z.object({
  awbOrInvoice: z.string().optional(),
  supplier: z.string().optional(),
  receivedBy: z.string().optional(),
  rows: z.array(rowSchema).default([]),
});

type SparesFormValues = z.infer<typeof sparesSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDocData(doc: SHDocumentDto | null): SparesFormValues {
  if (!doc?.data || typeof doc.data !== 'object') {
    return { awbOrInvoice: '', supplier: '', receivedBy: '', rows: [] };
  }
  const d = doc.data as Record<string, unknown>;
  return {
    awbOrInvoice: typeof d.awbOrInvoice === 'string' ? d.awbOrInvoice : '',
    supplier: typeof d.supplier === 'string' ? d.supplier : '',
    receivedBy: typeof d.receivedBy === 'string' ? d.receivedBy : '',
    rows: Array.isArray(d.rows)
      ? (d.rows as Array<Record<string, unknown>>).map((r) => ({
          description: typeof r.description === 'string' ? r.description : '',
          qty: typeof r.qty === 'number' ? r.qty : 1,
          unit: typeof r.unit === 'string' ? r.unit : '',
          weightKg: typeof r.weightKg === 'number' ? r.weightKg : undefined,
        }))
      : [],
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SparesFormProps {
  nominationId: string;
  doc: SHDocumentDto | null;
  isLoading: boolean;
  docType: Extract<SHDocumentType, 'SH_28A' | 'SH_29A'>;
  title: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SparesForm({ nominationId, doc, isLoading, docType, title }: SparesFormProps) {
  const [sendDrawerOpen, setSendDrawerOpen] = useState(false);

  const createDoc = useCreateShDocument(nominationId);
  const updateDoc = useUpdateShDocument(nominationId);
  const finalizeDoc = useFinalizeShDocument(nominationId);
  const generateDoc = useGenerateShDocument(nominationId);
  const pdfUrlQuery = usePdfUrl(nominationId, doc?.minioKey ? doc.id : null);

  const isSent = doc?.status === 'SENT';
  const isDisabled = isSent;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SparesFormValues>({
    resolver: zodResolver(sparesSchema),
    values: parseDocData(doc),
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'rows' });

  type SparesColKey = 'description' | 'qty' | 'unit' | 'weightKg' | 'accion';
  const INITIAL_WIDTHS: Record<SparesColKey, number> = {
    description: 200,
    qty: 100,
    unit: 100,
    weightKg: 120,
    accion: 80,
  };
  const { colWidths, startResize } = useColumnResize<SparesColKey>(INITIAL_WIDTHS);

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="sm" />
      </Stack>
    );
  }

  if (!doc) {
    return (
      <Stack gap="sm" py="md">
        <Text size="sm" c="dimmed">
          No hay documento {docType.replace(/_/g, '-')} para esta nominacion.
        </Text>
        <Button
          size="xs"
          variant="light"
          loading={createDoc.isPending}
          onClick={() => {
            createDoc.mutate({
              type: docType,
              data: { type: docType, awbOrInvoice: '', supplier: '', rows: [] },
            });
          }}
        >
          Crear {docType.replace(/_/g, '-')}
        </Button>
        {createDoc.isError && (
          <Alert color="red" title="Error">
            {createDoc.error instanceof Error ? createDoc.error.message : 'Error al crear.'}
          </Alert>
        )}
      </Stack>
    );
  }

  async function onSave(values: SparesFormValues) {
    updateDoc.mutate({
      shId: doc!.id,
      body: { data: { type: docType, ...values } },
    });
  }

  return (
    <>
      <form onSubmit={(e) => void handleSubmit(onSave)(e)}>
        <Stack gap="sm" py="md">
          <Group justify="space-between" align="center">
            <Text fw={600} size="sm">
              {title}
            </Text>
            <ShDocStatusBadge status={doc.status} />
          </Group>

          {isSent && (
            <Alert color="green" title="Documento enviado — solo lectura">
              Este documento ya fue enviado y no puede modificarse.
            </Alert>
          )}

          <TextInput
            label="AWB / Factura"
            placeholder="Opcional"
            disabled={isDisabled}
            {...register('awbOrInvoice')}
            error={errors.awbOrInvoice?.message}
          />

          <TextInput
            label="Proveedor"
            placeholder="Opcional"
            disabled={isDisabled}
            {...register('supplier')}
            error={errors.supplier?.message}
          />

          <TextInput
            label="Recibido por"
            placeholder="Opcional"
            disabled={isDisabled}
            {...register('receivedBy')}
            error={errors.receivedBy?.message}
          />

          {/* Rows table */}
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Articulos
            </Text>
            <Table withTableBorder withColumnBorders fz="xs" style={{ tableLayout: 'fixed' }}>
              <Table.Thead>
                <Table.Tr>
                  <ResizableTh
                    width={colWidths.description}
                    onResize={(e) => startResize('description', e)}
                  >
                    Descripcion
                  </ResizableTh>
                  <ResizableTh width={colWidths.qty} onResize={(e) => startResize('qty', e)}>
                    Cantidad
                  </ResizableTh>
                  <ResizableTh width={colWidths.unit} onResize={(e) => startResize('unit', e)}>
                    Unidad
                  </ResizableTh>
                  <ResizableTh
                    width={colWidths.weightKg}
                    onResize={(e) => startResize('weightKg', e)}
                  >
                    Peso (Kg)
                  </ResizableTh>
                  {!isDisabled && (
                    <ResizableTh
                      width={colWidths.accion}
                      onResize={(e) => startResize('accion', e)}
                    >
                      Accion
                    </ResizableTh>
                  )}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {fields.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={isDisabled ? 4 : 5}>
                      <Text size="xs" c="dimmed" ta="center">
                        Sin articulos — haga clic en "Agregar articulo" para comenzar.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {fields.map((field, idx) => (
                  <Table.Tr key={field.id}>
                    <Table.Td style={{ width: colWidths.description }}>
                      <TextInput
                        size="xs"
                        placeholder="Descripcion..."
                        disabled={isDisabled}
                        {...register(`rows.${idx}.description`)}
                        error={errors.rows?.[idx]?.description?.message}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.qty }}>
                      <Controller
                        name={`rows.${idx}.qty`}
                        control={control}
                        render={({ field: f }) => (
                          <NumberInput
                            size="xs"
                            min={0.01}
                            step={1}
                            disabled={isDisabled}
                            value={f.value}
                            onChange={(val) => f.onChange(val === '' ? 1 : val)}
                            error={errors.rows?.[idx]?.qty?.message}
                          />
                        )}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.unit }}>
                      <TextInput
                        size="xs"
                        placeholder="pcs, kg..."
                        disabled={isDisabled}
                        {...register(`rows.${idx}.unit`)}
                        error={errors.rows?.[idx]?.unit?.message}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.weightKg }}>
                      <Controller
                        name={`rows.${idx}.weightKg`}
                        control={control}
                        render={({ field: f }) => (
                          <NumberInput
                            size="xs"
                            min={0}
                            step={0.1}
                            disabled={isDisabled}
                            value={f.value ?? ''}
                            onChange={(val) => f.onChange(val === '' ? undefined : val)}
                            error={errors.rows?.[idx]?.weightKg?.message}
                          />
                        )}
                      />
                    </Table.Td>
                    {!isDisabled && (
                      <Table.Td style={{ width: colWidths.accion }}>
                        <Button size="xs" variant="subtle" color="red" onClick={() => remove(idx)}>
                          Quitar
                        </Button>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            {!isDisabled && (
              <Button
                size="xs"
                variant="default"
                onClick={() => append({ description: '', qty: 1, unit: '', weightKg: undefined })}
              >
                Agregar articulo
              </Button>
            )}
          </Stack>

          {/* Action buttons */}
          <Group gap="xs" wrap="wrap">
            {!isDisabled && (
              <Button type="submit" size="xs" loading={updateDoc.isPending}>
                Guardar
              </Button>
            )}

            {doc.status === 'DRAFT' && (
              <Button
                size="xs"
                variant="light"
                color="yellow"
                loading={finalizeDoc.isPending}
                onClick={() => finalizeDoc.mutate(doc.id)}
              >
                Finalizar
              </Button>
            )}

            {doc.status === 'FINALIZED' && (
              <Button
                size="xs"
                variant="light"
                color="teal"
                loading={generateDoc.isPending}
                onClick={() => generateDoc.mutate(doc.id)}
              >
                Generar PDF
              </Button>
            )}

            {doc.minioKey && pdfUrlQuery.data && (
              <Anchor href={pdfUrlQuery.data.url} target="_blank" size="xs">
                Abrir PDF
              </Anchor>
            )}

            {doc.status !== 'DRAFT' && (
              <Button
                size="xs"
                variant="light"
                color="green"
                onClick={() => setSendDrawerOpen(true)}
              >
                Enviar
              </Button>
            )}
          </Group>

          {updateDoc.isError && (
            <Alert color="red" title="Error al guardar">
              {updateDoc.error instanceof Error ? updateDoc.error.message : 'Error inesperado.'}
            </Alert>
          )}
          {finalizeDoc.isError && (
            <Alert color="red" title="Error al finalizar">
              {finalizeDoc.error instanceof Error ? finalizeDoc.error.message : 'Error inesperado.'}
            </Alert>
          )}
          {generateDoc.isError && (
            <Alert color="red" title="Error al generar PDF">
              {generateDoc.error instanceof Error ? generateDoc.error.message : 'Error inesperado.'}
            </Alert>
          )}
        </Stack>
      </form>

      {sendDrawerOpen && (
        <SendShDocumentDrawer
          opened={sendDrawerOpen}
          onClose={() => setSendDrawerOpen(false)}
          nominationId={nominationId}
          doc={doc}
        />
      )}
    </>
  );
}
