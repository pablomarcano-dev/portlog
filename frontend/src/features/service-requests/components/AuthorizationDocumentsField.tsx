import { useState } from 'react';
import {
  Anchor,
  Button,
  CloseButton,
  FileButton,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  isAllowedAttachmentMimeType,
  type ServiceRequestDocument,
} from '@portlog/schemas';
import { uploadAttachment } from '../../../lib/api/attachments';
import { useAddServiceRequestDocuments, useRemoveServiceRequestDocument } from '../hooks';

/**
 * The authority authorisation letter, plus any other supporting scan.
 *
 * Two-step upload, reusing the existing attachment plumbing: the file goes to
 * MinIO via POST /api/attachments, then the resulting id is filed against this
 * request. The spec asks for "take a photo or upload the PDF", which is what a
 * phone's file picker offers for an image input.
 */

const MAX_MB = Math.round(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024));

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  requestId: string;
  documents: ServiceRequestDocument[];
  disabled?: boolean;
}

export function AuthorizationDocumentsField({ requestId, documents, disabled = false }: Props) {
  const [pending, setPending] = useState<string[]>([]);
  const addDocuments = useAddServiceRequestDocuments(requestId);
  const removeDocument = useRemoveServiceRequestDocument(requestId);

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;

    const accepted: File[] = [];
    for (const file of files) {
      if (!isAllowedAttachmentMimeType(file.type)) {
        notifications.show({
          color: 'red',
          title: 'Unsupported file type',
          message: `${file.name} (${file.type || 'unknown type'})`,
        });
        continue;
      }
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        notifications.show({
          color: 'red',
          title: 'File too large',
          message: `${file.name} exceeds the ${MAX_MB} MB limit`,
        });
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length === 0) return;

    setPending(accepted.map((f) => f.name));
    try {
      // Accumulate the ids locally and file them in one call — updating state
      // per file loses all but the last upload when several finish together.
      const uploadedIds: string[] = [];
      for (const file of accepted) {
        const result = await uploadAttachment(file);
        uploadedIds.push(result.id);
      }
      await addDocuments.mutateAsync(uploadedIds);
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Could not upload the document',
        message: err instanceof Error ? err.message : 'Please try again',
      });
    } finally {
      setPending([]);
    }
  }

  const busy = pending.length > 0 || addDocuments.isPending;

  return (
    <Stack gap="xs">
      <Group gap="sm">
        <FileButton
          multiple
          disabled={disabled || busy}
          accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(',')}
          onChange={(files) => void handleFiles(files ?? [])}
        >
          {(props) => (
            <Button {...props} variant="light" size="xs" loading={busy}>
              Upload authorisation / photo
            </Button>
          )}
        </FileButton>
        <Text size="xs" c="dimmed">
          PDF or image, up to {MAX_MB} MB per file.
        </Text>
      </Group>

      {pending.map((name) => (
        <Paper key={name} withBorder p="xs">
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              {name}
            </Text>
          </Group>
        </Paper>
      ))}

      {documents.map((doc) => (
        <Paper key={doc.id} withBorder p="xs">
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <Anchor
                size="sm"
                href={`${import.meta.env.VITE_API_URL as string}/attachments/${doc.id}/download`}
                target="_blank"
                rel="noreferrer"
              >
                {doc.filename}
              </Anchor>
              <Text size="xs" c="dimmed">
                {formatBytes(doc.sizeBytes)}
              </Text>
            </Group>
            <CloseButton
              aria-label={`Remove ${doc.filename}`}
              disabled={disabled || removeDocument.isPending}
              onClick={() => removeDocument.mutate(doc.id)}
            />
          </Group>
        </Paper>
      ))}

      {documents.length === 0 && pending.length === 0 && (
        <Text size="sm" c="dimmed">
          No documents uploaded.
        </Text>
      )}
    </Stack>
  );
}
