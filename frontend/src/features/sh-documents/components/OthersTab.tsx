import { useState, useEffect } from 'react';
import { Alert, Button, Group, Loader, Stack, Text, Textarea } from '@mantine/core';
import type { SHDocumentDto } from '@portlog/schemas';
import { useCreateShDocument, useUpdateShDocument } from '../api';
import { ShDocStatusBadge } from './ShDocStatusBadge';
import { SendShDocumentDrawer } from './SendShDocumentDrawer';

interface OthersTabProps {
  nominationId: string;
  doc: SHDocumentDto | null;
  isLoading: boolean;
}

export function OthersTab({ nominationId, doc, isLoading }: OthersTabProps) {
  const [sendDrawerOpen, setSendDrawerOpen] = useState(false);

  const createDoc = useCreateShDocument(nominationId);
  const updateDoc = useUpdateShDocument(nominationId);

  const isSent = doc?.status === 'SENT';

  const existingHtml =
    doc?.data && typeof doc.data === 'object' && 'html' in doc.data
      ? String((doc.data as Record<string, unknown>).html ?? '')
      : '';

  const [html, setHtml] = useState(existingHtml);

  useEffect(() => {
    setHtml(existingHtml);
  }, [doc?.id, existingHtml]);

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
          No hay documento "Otros" para esta nominacion.
        </Text>
        <Button
          size="xs"
          variant="light"
          loading={createDoc.isPending}
          onClick={() => {
            createDoc.mutate({
              type: 'OTHER',
              data: { type: 'OTHER', html: '' },
            });
          }}
        >
          Crear documento
        </Button>
        {createDoc.isError && (
          <Alert color="red" title="Error">
            {createDoc.error instanceof Error ? createDoc.error.message : 'Error al crear.'}
          </Alert>
        )}
      </Stack>
    );
  }

  return (
    <>
      <Stack gap="sm" py="md">
        <Group justify="space-between" align="center">
          <Text fw={600} size="sm">
            Otros
          </Text>
          <ShDocStatusBadge status={doc.status} />
        </Group>

        {isSent && (
          <Alert color="green" title="Documento enviado — solo lectura">
            Este documento ya fue enviado y no puede modificarse.
          </Alert>
        )}

        <Textarea
          label="Contenido"
          minRows={8}
          autosize
          value={html}
          onChange={(e) => setHtml(e.currentTarget.value)}
          disabled={isSent}
          placeholder="Escriba el contenido del documento aqui..."
        />

        <Alert color="blue" title="Adjuntos de archivo">
          La carga de archivos estara disponible en una version futura.
        </Alert>

        <Group gap="xs">
          {!isSent && (
            <Button
              size="xs"
              loading={updateDoc.isPending}
              onClick={() => {
                updateDoc.mutate({
                  shId: doc.id,
                  body: { data: { type: 'OTHER', html } },
                });
              }}
            >
              Guardar
            </Button>
          )}

          {doc.status !== 'DRAFT' && (
            <Button size="xs" variant="light" color="green" onClick={() => setSendDrawerOpen(true)}>
              Enviar
            </Button>
          )}
        </Group>

        {updateDoc.isError && (
          <Alert color="red" title="Error al guardar">
            {updateDoc.error instanceof Error ? updateDoc.error.message : 'Error inesperado.'}
          </Alert>
        )}
      </Stack>

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
