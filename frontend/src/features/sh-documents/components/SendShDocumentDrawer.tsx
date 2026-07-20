import {
  Alert,
  Button,
  Drawer,
  Group,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSendShDocument } from '../api';
import { EmailGroupPicker } from '../../../components/master-data/EmailGroupPicker';
import type { SHDocumentDto } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const sendSchema = z.object({
  toAddresses: z.array(z.string()).min(1, 'Al menos un destinatario es requerido'),
  ccAddresses: z.array(z.string()).default([]),
  subject: z.string().min(1, 'El asunto es requerido'),
  bodyHtml: z.string().default(''),
});
type SendForm = z.infer<typeof sendSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SendShDocumentDrawerProps {
  opened: boolean;
  onClose: () => void;
  nominationId: string;
  doc: SHDocumentDto;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SendShDocumentDrawer({
  opened,
  onClose,
  nominationId,
  doc,
}: SendShDocumentDrawerProps) {
  const sendDoc = useSendShDocument(nominationId);

  const defaultSubject = `${doc.type.replace(/_/g, '-')} — ${doc.title ?? doc.type}`;

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SendForm>({
    resolver: zodResolver(sendSchema),
    defaultValues: {
      toAddresses: [],
      ccAddresses: [],
      subject: defaultSubject,
      bodyHtml: '',
    },
  });

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(values: SendForm) {
    const toAddresses = values.toAddresses.map((e) => e.trim()).filter(Boolean);
    const ccAddresses = values.ccAddresses.map((e) => e.trim()).filter(Boolean);

    sendDoc.mutate(
      {
        shId: doc.id,
        body: {
          toAddresses,
          ccAddresses,
          subject: values.subject,
          bodyHtml: values.bodyHtml || undefined,
        },
      },
      {
        onSuccess: () => {
          handleClose();
        },
      },
    );
  }

  const isSent = doc.status === 'SENT';

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      title={
        <Text fw={600} size="sm">
          Enviar {doc.type.replace(/_/g, '-')}
        </Text>
      }
      position="right"
      size="md"
      padding="lg"
    >
      {isSent ? (
        <Alert color="green" title="Documento enviado — solo lectura">
          Este documento ya fue enviado el{' '}
          {doc.sentAt ? new Date(doc.sentAt).toLocaleString() : 'fecha desconocida'}.
        </Alert>
      ) : (
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
          <Stack gap="sm">
            <Controller
              name="toAddresses"
              control={control}
              render={({ field }) => (
                <TagsInput
                  label="Para"
                  description="Escriba un correo y presione Enter, o agregue desde un grupo"
                  placeholder="destinatario@ejemplo.com"
                  required
                  data-cy="sh-send-to"
                  value={field.value}
                  onChange={field.onChange}
                  splitChars={[',', ' ']}
                  error={errors.toAddresses?.message}
                />
              )}
            />

            <Controller
              name="ccAddresses"
              control={control}
              render={({ field }) => (
                <TagsInput
                  label="CC"
                  description="Opcional"
                  placeholder="cc@ejemplo.com"
                  value={field.value}
                  onChange={field.onChange}
                  splitChars={[',', ' ']}
                  error={errors.ccAddresses?.message}
                />
              )}
            />

            <EmailGroupPicker
              targets={[
                {
                  key: 'to',
                  label: 'Para',
                  value: watch('toAddresses'),
                  onChange: (v) => setValue('toAddresses', v, { shouldValidate: true }),
                },
                {
                  key: 'cc',
                  label: 'CC',
                  value: watch('ccAddresses'),
                  onChange: (v) => setValue('ccAddresses', v),
                },
              ]}
            />

            <TextInput
              label="Asunto"
              required
              {...register('subject')}
              error={errors.subject?.message}
            />

            <Textarea
              label="Cuerpo"
              description="Opcional — deje en blanco para usar la plantilla predeterminada"
              minRows={4}
              autosize
              {...register('bodyHtml')}
              error={errors.bodyHtml?.message}
            />

            {sendDoc.isError && (
              <Alert color="red" title="Error al enviar">
                {sendDoc.error instanceof Error
                  ? sendDoc.error.message
                  : 'No se pudo enviar el documento.'}
              </Alert>
            )}

            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={handleClose} disabled={sendDoc.isPending}>
                Cancelar
              </Button>
              <Button type="submit" loading={sendDoc.isPending} data-cy="sh-send-submit">
                Enviar
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Drawer>
  );
}
