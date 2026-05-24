import { useState, useEffect } from 'react';
import { Alert, Button, Group, Loader, Stack, Text, Textarea } from '@mantine/core';
import type { SHDocumentDto } from '@portlog/schemas';
import { useCreateShDocument, useUpdateShDocument } from '../api';

interface CommentsTabProps {
  nominationId: string;
  doc: SHDocumentDto | null;
  isLoading: boolean;
}

export function CommentsTab({ nominationId, doc, isLoading }: CommentsTabProps) {
  const createDoc = useCreateShDocument(nominationId);
  const updateDoc = useUpdateShDocument(nominationId);

  const isSent = doc?.status === 'SENT';
  const existingHtml =
    doc?.data && typeof doc.data === 'object' && 'html' in doc.data
      ? String((doc.data as Record<string, unknown>).html ?? '')
      : '';

  const [html, setHtml] = useState(existingHtml);

  // Sync local state when the doc loads or changes (keyed on doc id + content)
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
          No hay comentario adjunto a esta nominacion.
        </Text>
        <Button
          size="xs"
          variant="light"
          loading={createDoc.isPending}
          onClick={() => {
            createDoc.mutate({ type: 'COMMENT', data: { type: 'COMMENT', html: '' } });
          }}
        >
          Nuevo comentario
        </Button>
        {createDoc.isError && (
          <Alert color="red" title="Error">
            {createDoc.error instanceof Error
              ? createDoc.error.message
              : 'No se pudo crear el comentario.'}
          </Alert>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="sm" py="md">
      {isSent && (
        <Alert color="green" title="Documento enviado — solo lectura">
          Este comentario ya fue enviado y no puede modificarse.
        </Alert>
      )}

      <Textarea
        label="Comentario"
        minRows={8}
        autosize
        value={html}
        onChange={(e) => setHtml(e.currentTarget.value)}
        disabled={isSent}
        placeholder="Escriba su comentario aqui..."
      />

      {!isSent && (
        <Group justify="flex-end">
          <Button
            size="xs"
            loading={updateDoc.isPending}
            onClick={() => {
              updateDoc.mutate({
                shId: doc.id,
                body: { data: { type: 'COMMENT', html } },
              });
            }}
          >
            Guardar
          </Button>
        </Group>
      )}

      {updateDoc.isError && (
        <Alert color="red" title="Error al guardar">
          {updateDoc.error instanceof Error
            ? updateDoc.error.message
            : 'No se pudo guardar el comentario.'}
        </Alert>
      )}
    </Stack>
  );
}
