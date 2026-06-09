import { useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { SHDocumentDto } from '@portlog/schemas';
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
  date: z.string().min(1, 'Fecha requerida'),
  from: z.string().min(1, 'Desde requerido'),
  to: z.string().min(1, 'Hasta requerido'),
  activity: z.string().min(1, 'Actividad requerida'),
});

const sh66aSchema = z.object({
  vesselReference: z.string().optional(),
  notes: z.string().optional(),
  rows: z.array(rowSchema).default([]),
});

type Sh66aForm = z.infer<typeof sh66aSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDocData(doc: SHDocumentDto | null): Sh66aForm {
  if (!doc?.data || typeof doc.data !== 'object') {
    return { vesselReference: '', notes: '', rows: [] };
  }
  const d = doc.data as Record<string, unknown>;
  return {
    vesselReference: typeof d.vesselReference === 'string' ? d.vesselReference : '',
    notes: typeof d.notes === 'string' ? d.notes : '',
    rows: Array.isArray(d.rows)
      ? (d.rows as Array<Record<string, unknown>>).map((r) => ({
          date: typeof r.date === 'string' ? r.date : '',
          from: typeof r.from === 'string' ? r.from : '',
          to: typeof r.to === 'string' ? r.to : '',
          activity: typeof r.activity === 'string' ? r.activity : '',
        }))
      : [],
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Sh66aFormProps {
  nominationId: string;
  doc: SHDocumentDto | null;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Sh66aForm({ nominationId, doc, isLoading }: Sh66aFormProps) {
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
  } = useForm<Sh66aForm>({
    resolver: zodResolver(sh66aSchema),
    values: parseDocData(doc),
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'rows' });

  type Sh66aColKey = 'date' | 'from' | 'to' | 'activity' | 'accion';
  const INITIAL_WIDTHS: Record<Sh66aColKey, number> = {
    date: 130,
    from: 120,
    to: 120,
    activity: 200,
    accion: 80,
  };
  const { colWidths, startResize } = useColumnResize<Sh66aColKey>(INITIAL_WIDTHS);

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
          No hay documento SH-66A para esta nominacion.
        </Text>
        <Button
          size="xs"
          variant="light"
          loading={createDoc.isPending}
          data-cy="sh-create"
          onClick={() => {
            createDoc.mutate({
              type: 'SH_66A',
              data: { type: 'SH_66A', vesselReference: '', rows: [], notes: '' },
            });
          }}
        >
          Crear SH-66A
        </Button>
        {createDoc.isError && (
          <Alert color="red" title="Error">
            {createDoc.error instanceof Error ? createDoc.error.message : 'Error al crear.'}
          </Alert>
        )}
      </Stack>
    );
  }

  async function onSave(values: Sh66aForm) {
    updateDoc.mutate({
      shId: doc!.id,
      body: { data: { type: 'SH_66A', ...values } },
    });
  }

  return (
    <>
      <form onSubmit={(e) => void handleSubmit(onSave)(e)}>
        <Stack gap="sm" py="md">
          <Group justify="space-between" align="center">
            <Text fw={600} size="sm">
              SH-66A — Horas Extras
            </Text>
            <span data-cy="sh-status">
              <ShDocStatusBadge status={doc.status} />
            </span>
          </Group>

          {isSent && (
            <Alert color="green" title="Documento enviado — solo lectura">
              Este documento ya fue enviado y no puede modificarse.
            </Alert>
          )}

          <TextInput
            label="Referencia del buque"
            placeholder="Opcional"
            disabled={isDisabled}
            {...register('vesselReference')}
            error={errors.vesselReference?.message}
          />

          <Textarea
            label="Notas"
            placeholder="Opcional"
            minRows={2}
            autosize
            disabled={isDisabled}
            {...register('notes')}
            error={errors.notes?.message}
          />

          {/* Rows table */}
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Filas de horas extras
            </Text>
            <Table withTableBorder withColumnBorders fz="xs" style={{ tableLayout: 'fixed' }}>
              <Table.Thead>
                <Table.Tr>
                  <ResizableTh width={colWidths.date} onResize={(e) => startResize('date', e)}>
                    Fecha (YYYY-MM-DD)
                  </ResizableTh>
                  <ResizableTh width={colWidths.from} onResize={(e) => startResize('from', e)}>
                    Desde (HH:mm)
                  </ResizableTh>
                  <ResizableTh width={colWidths.to} onResize={(e) => startResize('to', e)}>
                    Hasta (HH:mm)
                  </ResizableTh>
                  <ResizableTh
                    width={colWidths.activity}
                    onResize={(e) => startResize('activity', e)}
                  >
                    Actividad
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
                        Sin filas — haga clic en "Agregar fila" para comenzar.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {fields.map((field, idx) => (
                  <Table.Tr key={field.id}>
                    <Table.Td style={{ width: colWidths.date }}>
                      <TextInput
                        size="xs"
                        placeholder="2025-01-15"
                        disabled={isDisabled}
                        {...register(`rows.${idx}.date`)}
                        error={errors.rows?.[idx]?.date?.message}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.from }}>
                      <TextInput
                        size="xs"
                        placeholder="08:00"
                        disabled={isDisabled}
                        {...register(`rows.${idx}.from`)}
                        error={errors.rows?.[idx]?.from?.message}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.to }}>
                      <TextInput
                        size="xs"
                        placeholder="10:00"
                        disabled={isDisabled}
                        {...register(`rows.${idx}.to`)}
                        error={errors.rows?.[idx]?.to?.message}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.activity }}>
                      <TextInput
                        size="xs"
                        placeholder="Carga / Descarga..."
                        disabled={isDisabled}
                        {...register(`rows.${idx}.activity`)}
                        error={errors.rows?.[idx]?.activity?.message}
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
                data-cy="sh-add-row"
                onClick={() => append({ date: '', from: '', to: '', activity: '' })}
              >
                Agregar fila
              </Button>
            )}
          </Stack>

          {/* Action buttons */}
          <Group gap="xs" wrap="wrap">
            {!isDisabled && (
              <Button type="submit" size="xs" loading={updateDoc.isPending} data-cy="sh-save">
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
                data-cy="sh-finalize"
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
                data-cy="sh-generate"
              >
                Generar PDF
              </Button>
            )}

            {doc.minioKey && pdfUrlQuery.data && (
              <Anchor href={pdfUrlQuery.data.url} target="_blank" size="xs" data-cy="sh-open-pdf">
                Abrir PDF
              </Anchor>
            )}

            {doc.status !== 'DRAFT' && (
              <Button
                size="xs"
                variant="light"
                color="green"
                onClick={() => setSendDrawerOpen(true)}
                data-cy="sh-send"
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
