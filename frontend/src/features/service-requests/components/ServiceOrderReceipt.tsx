import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Anchor,
  Button,
  Card,
  FileButton,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { Controller, useForm } from 'react-hook-form';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  ServiceRequestReceiptSchema,
  isAllowedAttachmentMimeType,
  type ServiceRequestRead,
  type ServiceRequestReceipt,
} from '@portlog/schemas';
import { downloadAttachment, uploadAttachment } from '../../../lib/api/attachments';
import { formatDateTime } from '../../../lib/format/datetime';
import { useRecordServiceRequestReceipt } from '../hooks';

export function ServiceOrderReceipt({ request }: { request: ServiceRequestRead }) {
  const [uploading, setUploading] = useState(false);
  const save = useRecordServiceRequestReceipt(request.id);
  const recorded = request.receivedAt !== null;
  const { control, register, setValue, handleSubmit, formState, watch } =
    useForm<ServiceRequestReceipt>({
      resolver: zodResolver(ServiceRequestReceiptSchema),
      defaultValues: {
        receiptName: request.receiptName ?? '',
        receiptTitle: request.receiptTitle ?? '',
        receivedAt: request.receivedAt ?? new Date(),
        receiptAttachmentId: request.receiptAttachment?.id ?? null,
      },
    });

  async function uploadScan(file: File | null) {
    if (!file) return;
    if (!isAllowedAttachmentMimeType(file.type) || file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      notifications.show({
        color: 'red',
        message: 'Choose a PDF or image within the attachment size limit.',
      });
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadAttachment(file);
      setValue('receiptAttachmentId', uploaded.id, { shouldDirty: true });
      notifications.show({
        color: 'green',
        message: `${uploaded.filename} uploaded. Save the receipt to file it.`,
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Could not upload the scan',
      });
    } finally {
      setUploading(false);
    }
  }

  async function openScan() {
    if (!request.receiptAttachment) return;
    try {
      const blob = await downloadAttachment(request.receiptAttachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = request.receiptAttachment.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Could not download the scan',
      });
    }
  }

  const saveReceipt = handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: () => notifications.show({ color: 'green', message: 'Provider receipt recorded' }),
      onError: (error) =>
        notifications.show({
          color: 'red',
          message: error instanceof Error ? error.message : 'Could not save receipt',
        }),
    }),
  );

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={4}>Provider receipt</Title>
        <Text size="sm" c="dimmed">
          Record who received the issued order. A typed name does not replace the provider’s
          signature or stamp.
        </Text>
        {request.receiptRecordedBy && request.receiptRecordedAt && (
          <Text size="xs" c="dimmed">
            Recorded by{' '}
            {request.receiptRecordedBy.displayName?.trim() || request.receiptRecordedBy.email} on{' '}
            {formatDateTime(request.receiptRecordedAt)}
          </Text>
        )}
        <Group grow align="flex-start">
          <TextInput
            label="Recipient name"
            required
            disabled={recorded}
            error={formState.errors.receiptName?.message}
            {...register('receiptName')}
          />
          <TextInput
            label="Role / title"
            disabled={recorded}
            error={formState.errors.receiptTitle?.message}
            {...register('receiptTitle')}
          />
        </Group>
        <Controller
          name="receivedAt"
          control={control}
          render={({ field, fieldState }) => (
            <DateTimePicker
              label="Date and time received"
              required
              disabled={recorded}
              value={field.value instanceof Date ? field.value : null}
              onChange={field.onChange}
              error={fieldState.error?.message}
              valueFormat="DD/MM/YYYY HH:mm"
            />
          )}
        />
        <Group>
          <FileButton
            disabled={Boolean(request.receiptAttachment)}
            accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(',')}
            onChange={(file) => void uploadScan(file)}
          >
            {(props) => (
              <Button {...props} variant="light" loading={uploading}>
                Upload signed scan
              </Button>
            )}
          </FileButton>
          {request.receiptAttachment && (
            <Anchor component="button" type="button" onClick={() => void openScan()}>
              {request.receiptAttachment.filename}
            </Anchor>
          )}
          {watch('receiptAttachmentId') &&
            watch('receiptAttachmentId') !== request.receiptAttachment?.id && (
              <Text size="sm">New scan ready to file</Text>
            )}
        </Group>
        {(!recorded || !request.receiptAttachment) && (
          <Button
            onClick={() => void saveReceipt()}
            disabled={recorded && !watch('receiptAttachmentId')}
            loading={save.isPending || uploading}
            w="fit-content"
          >
            {recorded ? 'File signed scan' : 'Save receipt'}
          </Button>
        )}
      </Stack>
    </Card>
  );
}
