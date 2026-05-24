import { useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Group,
  Loader,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm, Controller } from 'react-hook-form';
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

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const sh09aSchema = z.object({
  patientName: z.string().min(1, 'Nombre del paciente requerido'),
  rank: z.string().optional(),
  vesselName: z.string().optional(),
  diagnosis: z.string().optional(),
  body: z.string().min(1, 'El cuerpo es requerido'),
  issuedAt: z.date().nullable().optional(),
});

type Sh09aFormValues = z.infer<typeof sh09aSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDocData(doc: SHDocumentDto | null): Sh09aFormValues {
  if (!doc?.data || typeof doc.data !== 'object') {
    return { patientName: '', rank: '', vesselName: '', diagnosis: '', body: '', issuedAt: null };
  }
  const d = doc.data as Record<string, unknown>;
  return {
    patientName: typeof d.patientName === 'string' ? d.patientName : '',
    rank: typeof d.rank === 'string' ? d.rank : '',
    vesselName: typeof d.vesselName === 'string' ? d.vesselName : '',
    diagnosis: typeof d.diagnosis === 'string' ? d.diagnosis : '',
    body: typeof d.body === 'string' ? d.body : '',
    issuedAt: typeof d.issuedAt === 'string' && d.issuedAt ? new Date(d.issuedAt) : null,
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Sh09aFormProps {
  nominationId: string;
  doc: SHDocumentDto | null;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Sh09aForm({ nominationId, doc, isLoading }: Sh09aFormProps) {
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
  } = useForm<Sh09aFormValues>({
    resolver: zodResolver(sh09aSchema),
    values: parseDocData(doc),
  });

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
          No hay documento SH-09A para esta nominacion.
        </Text>
        <Button
          size="xs"
          variant="light"
          loading={createDoc.isPending}
          onClick={() => {
            createDoc.mutate({
              type: 'SH_09A',
              data: { type: 'SH_09A', patientName: '', body: '' },
            });
          }}
        >
          Crear SH-09A
        </Button>
        {createDoc.isError && (
          <Alert color="red" title="Error">
            {createDoc.error instanceof Error ? createDoc.error.message : 'Error al crear.'}
          </Alert>
        )}
      </Stack>
    );
  }

  async function onSave(values: Sh09aFormValues) {
    updateDoc.mutate({
      shId: doc!.id,
      body: {
        data: {
          type: 'SH_09A',
          patientName: values.patientName,
          rank: values.rank,
          vesselName: values.vesselName,
          diagnosis: values.diagnosis,
          body: values.body,
          issuedAt: values.issuedAt ? values.issuedAt.toISOString().split('T')[0] : undefined,
        },
      },
    });
  }

  return (
    <>
      <form onSubmit={(e) => void handleSubmit(onSave)(e)}>
        <Stack gap="sm" py="md">
          <Group justify="space-between" align="center">
            <Text fw={600} size="sm">
              SH-09A — Garantia Medica
            </Text>
            <ShDocStatusBadge status={doc.status} />
          </Group>

          {isSent && (
            <Alert color="green" title="Documento enviado — solo lectura">
              Este documento ya fue enviado y no puede modificarse.
            </Alert>
          )}

          <TextInput
            label="Nombre del paciente"
            required
            disabled={isDisabled}
            {...register('patientName')}
            error={errors.patientName?.message}
          />

          <TextInput
            label="Rango"
            placeholder="Opcional"
            disabled={isDisabled}
            {...register('rank')}
            error={errors.rank?.message}
          />

          <TextInput
            label="Nombre del buque"
            placeholder="Opcional"
            disabled={isDisabled}
            {...register('vesselName')}
            error={errors.vesselName?.message}
          />

          <TextInput
            label="Diagnostico"
            placeholder="Opcional"
            disabled={isDisabled}
            {...register('diagnosis')}
            error={errors.diagnosis?.message}
          />

          <Controller
            name="issuedAt"
            control={control}
            render={({ field }) => (
              <DatePickerInput
                label="Fecha de emision"
                placeholder="Seleccione fecha"
                value={field.value ?? null}
                onChange={field.onChange}
                clearable
                disabled={isDisabled}
                error={errors.issuedAt?.message}
              />
            )}
          />

          <Textarea
            label="Cuerpo"
            required
            minRows={6}
            autosize
            disabled={isDisabled}
            {...register('body')}
            error={errors.body?.message}
          />

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
