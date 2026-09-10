import { useState, type DragEvent } from 'react';
import {
  Alert,
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
  MAX_ATTACHMENTS_PER_EMAIL,
  MAX_TOTAL_ATTACHMENTS_BYTES,
  isAllowedAttachmentMimeType,
} from '@portlog/schemas';
import { uploadAttachment, deleteAttachment } from '../../lib/api/attachments';

// ---------------------------------------------------------------------------
// EmailAttachmentsField — reusable upload widget for email compose surfaces.
//
// Uploads each selected file to MinIO immediately (POST /api/attachments) and
// tracks the resulting attachment IDs. `value` holds the IDs of successfully
// uploaded files; the parent submits them with the send request. Local UI
// metadata (filename/size) is kept alongside so we can render the list.
// ---------------------------------------------------------------------------

interface UploadedItem {
  id: string;
  filename: string;
  sizeBytes: number;
}

interface PendingItem {
  key: string;
  filename: string;
  sizeBytes: number;
}

export interface EmailAttachmentsFieldProps {
  /** IDs of successfully uploaded attachments (controlled). */
  value: string[];
  /** Called whenever the set of uploaded attachment IDs changes. */
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  label?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_MB = Math.round(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024));
const MAX_TOTAL_MB = Math.round(MAX_TOTAL_ATTACHMENTS_BYTES / (1024 * 1024));

export function EmailAttachmentsField({
  value,
  onChange,
  disabled = false,
  label = 'Attachments',
}: EmailAttachmentsFieldProps) {
  // Metadata for uploaded items, keyed by id. Kept in sync with `value`.
  const [items, setItems] = useState<UploadedItem[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const uploadedTotal = items.reduce((sum, it) => sum + it.sizeBytes, 0);

  async function handleSelect(files: File[]) {
    if (!files.length) return;

    let remainingSlots = MAX_ATTACHMENTS_PER_EMAIL - value.length - pending.length;
    let runningTotal = uploadedTotal + pending.reduce((s, p) => s + p.sizeBytes, 0);

    // `value` is the prop as of the render that started this loop: it does not
    // update while we await each upload. Accumulate the ids here and hand the
    // parent the whole list every time — rebuilding from the stale prop on each
    // iteration meant a multi-file selection submitted only the last upload.
    const nextIds = [...value];

    for (const file of files) {
      if (remainingSlots <= 0) {
        notifications.show({
          color: 'red',
          title: 'Too many attachments',
          message: `At most ${MAX_ATTACHMENTS_PER_EMAIL} files per email.`,
        });
        break;
      }
      if (!isAllowedAttachmentMimeType(file.type)) {
        notifications.show({
          color: 'red',
          title: 'Unsupported file type',
          message: `${file.name} (${file.type || 'unknown'}) is not allowed.`,
        });
        continue;
      }
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        notifications.show({
          color: 'red',
          title: 'File too large',
          message: `${file.name} exceeds the ${MAX_MB} MB per-file limit.`,
        });
        continue;
      }
      if (runningTotal + file.size > MAX_TOTAL_ATTACHMENTS_BYTES) {
        notifications.show({
          color: 'red',
          title: 'Attachments too large',
          message: `Total attachments would exceed the ${MAX_TOTAL_MB} MB limit.`,
        });
        break;
      }

      remainingSlots -= 1;
      runningTotal += file.size;

      const key = `${file.name}-${file.size}-${file.lastModified}`;
      setPending((prev) => [...prev, { key, filename: file.name, sizeBytes: file.size }]);

      try {
        const uploaded = await uploadAttachment(file);
        setItems((prev) => [
          ...prev,
          { id: uploaded.id, filename: uploaded.filename, sizeBytes: uploaded.sizeBytes },
        ]);
        nextIds.push(uploaded.id);
        onChange([...nextIds]);
      } catch (err) {
        notifications.show({
          color: 'red',
          title: 'Upload failed',
          message: err instanceof Error ? err.message : `Could not upload ${file.name}.`,
        });
      } finally {
        setPending((prev) => prev.filter((p) => p.key !== key));
      }
    }
  }

  function handleRemove(id: string) {
    // Optimistically drop from the UI + value; best-effort delete on the server.
    setItems((prev) => prev.filter((it) => it.id !== id));
    onChange(value.filter((v) => v !== id));
    void deleteAttachment(id).catch(() => {
      /* staged-object cleanup is best-effort; ignore */
    });
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) event.dataTransfer.dropEffect = 'copy';
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (disabled) return;
    void handleSelect(Array.from(event.dataTransfer.files));
  }

  const count = items.length + pending.length;

  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        {label}
        {count > 0 ? ` (${count})` : ''}
      </Text>

      <Paper
        withBorder
        p="md"
        radius="sm"
        data-cy="attachment-dropzone"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          borderColor: isDragging ? 'var(--mantine-color-blue-6)' : undefined,
          backgroundColor: isDragging ? 'var(--mantine-color-blue-0)' : undefined,
          transition: 'background-color 120ms ease, border-color 120ms ease',
        }}
      >
        <Stack gap={6} align="center">
          <Text size="sm" ta="center" fw={isDragging ? 600 : 400}>
            {isDragging ? 'Drop files to attach them' : 'Drag and drop files here'}
          </Text>
          <Text size="xs" c="dimmed">
            or
          </Text>
          <FileButton multiple onChange={(files) => void handleSelect(files)} disabled={disabled}>
            {(props) => (
              <Button {...props} size="xs" variant="light" data-cy="attach-files">
                Select files
              </Button>
            )}
          </FileButton>
          <Text size="xs" c="dimmed" ta="center">
            Up to {MAX_ATTACHMENTS_PER_EMAIL} files, {MAX_MB} MB each, {MAX_TOTAL_MB} MB total.
          </Text>
        </Stack>
      </Paper>

      {count === 0 ? null : (
        <Stack gap={4}>
          {items.map((it) => (
            <Paper key={it.id} withBorder p="xs" radius="sm">
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Text size="sm" truncate="end" style={{ flex: 1 }}>
                  {it.filename}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatBytes(it.sizeBytes)}
                </Text>
                <CloseButton
                  size="sm"
                  aria-label={`Remove ${it.filename}`}
                  onClick={() => handleRemove(it.id)}
                  disabled={disabled}
                />
              </Group>
            </Paper>
          ))}
          {pending.map((p) => (
            <Paper key={p.key} withBorder p="xs" radius="sm">
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
                  <Loader size="xs" />
                  <Text size="sm" truncate="end" c="dimmed">
                    {p.filename}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {formatBytes(p.sizeBytes)}
                </Text>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      {count >= MAX_ATTACHMENTS_PER_EMAIL && (
        <Alert color="yellow" p="xs">
          Attachment limit reached.
        </Alert>
      )}
    </Stack>
  );
}

// Re-exported for callers that want to build an <input accept=...> hint.
export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_MIME_TYPES.join(',');
