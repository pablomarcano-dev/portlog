import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Divider,
  Drawer,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  ServiceRequestSendReadinessSchema,
  resolveServiceLabel,
  type ServiceRequestRead,
} from '@portlog/schemas';
import { EmailChipsInput } from '../../../components/master-data/EmailChipsInput';
import { EmailAttachmentsField } from '../../../components/master-data/EmailAttachmentsField';
import { formatDateTime } from '../../../lib/format/datetime';
import { useSendServiceRequestOrder } from '../hooks';

/**
 * Generate the purchase order and email it to the provider.
 *
 * The readiness rules are checked here so the operator sees *why* the button is
 * disabled; the backend re-checks them on POST (Golden Rule 5) because this
 * check is advisory only.
 */

interface Props {
  opened: boolean;
  onClose: () => void;
  request: ServiceRequestRead;
}

/**
 * The default message body. Spanish, like the attached purchase order — the
 * recipient is the Venezuelan provider, not a Portlog user. The operator can
 * rewrite it before sending.
 */
function defaultBody(request: ServiceRequestRead): string {
  return [
    'Estimados señores,',
    '',
    `Por medio de la presente enviamos la Orden de Compra ${request.controlNumber} correspondiente al servicio detallado a continuación:`,
    '',
    `  Asignado a: ${request.shipParticular?.name ?? 'Administración'}`,
    `  Servicio:   ${resolveServiceLabel(request.details)}`,
    `  Programado: ${formatDateTime(request.scheduledAt)}`,
    '',
    'Se adjunta la Orden de Compra y la documentación de respaldo.',
    '',
    'Agradecemos confirmar recepción.',
  ].join('\n');
}

export function SendOrderDrawer({ opened, onClose, request }: Props) {
  const send = useSendServiceRequestOrder(request.id);

  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);

  // Reset every time the drawer opens so a previous failed attempt's edits do
  // not leak into the next send, and the provider's current addresses are
  // re-read.
  useEffect(() => {
    if (!opened) return;
    setTo(request.supplier?.emails ?? []);
    setCc([]);
    // Subject and body are Spanish to match the attached purchase order; the
    // recipient is the provider, not a Portlog user. Both stay editable.
    setSubject(
      `Orden de Compra ${request.controlNumber} — ${request.shipParticular?.name ?? 'Administración'} — ${resolveServiceLabel(request.details)}`,
    );
    setBody(defaultBody(request));
    setAttachmentIds([]);
  }, [opened, request]);

  const readiness = ServiceRequestSendReadinessSchema.safeParse({
    supplierId: request.supplierId,
    details: request.details,
    documentCount: request.documents.length,
  });
  const blockers = readiness.success ? [] : readiness.error.issues.map((i) => i.message);
  const canSend = blockers.length === 0 && to.length > 0 && !send.isPending;

  function handleSend() {
    send.mutate(
      {
        toAddresses: to,
        ccAddresses: cc,
        bccAddresses: [],
        subject: subject.trim() === '' ? undefined : subject,
        bodyText: body.trim() === '' ? undefined : body,
        attachmentIds,
      },
      {
        onSuccess: (result) => {
          if (result.dispatch.sentAt === null) {
            // The request is SENT either way; the dispatch row carries the SMTP
            // error and the operator re-sends from the dispatch log.
            notifications.show({
              color: 'orange',
              title: 'Order recorded but the email failed',
              message: 'Check the dispatch history and retry.',
            });
          } else {
            notifications.show({
              color: 'green',
              title: 'Order sent',
              message: `${request.controlNumber} sent to ${to.join(', ')}`,
            });
          }
          onClose();
        },
        onError: (err) => {
          notifications.show({
            color: 'red',
            title: 'Could not send the order',
            message: err instanceof Error ? err.message : 'Please try again',
          });
        },
      },
    );
  }

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={`Generate & Send Order — ${request.controlNumber}`}
    >
      <Stack gap="sm">
        {blockers.length > 0 && (
          <Alert color="red" title="Cannot send yet">
            <Stack gap={4}>
              {blockers.map((message) => (
                <Text key={message} size="sm">
                  • {message}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        {request.sentAt && (
          <Alert color="orange" variant="light">
            This order was already sent on {formatDateTime(request.sentAt)}. Sending again
            regenerates the PDF and records a new dispatch.
          </Alert>
        )}

        <EmailChipsInput
          label="To"
          value={to}
          onChange={setTo}
          description={
            request.supplier
              ? `Registered addresses for ${request.supplier.name}`
              : 'Select a provider to pre-fill their addresses'
          }
        />
        <EmailChipsInput label="CC" value={cc} onChange={setCc} />

        <TextInput
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.currentTarget.value)}
        />

        <Textarea
          label="Message"
          autosize
          minRows={8}
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
        />

        <Divider label="Attachments" labelPosition="left" />
        <Text size="xs" c="dimmed">
          The purchase order PDF
          {request.documents.length > 0
            ? ` and ${request.documents.length} request document(s) are attached automatically.`
            : ' is attached automatically.'}
        </Text>
        <EmailAttachmentsField
          value={attachmentIds}
          onChange={setAttachmentIds}
          label="Additional attachments"
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose} disabled={send.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend} loading={send.isPending}>
            Generate &amp; Send Order
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
