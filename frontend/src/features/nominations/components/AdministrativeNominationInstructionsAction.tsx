import { useState } from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useIsMutating, useMutation } from '@tanstack/react-query';
import { nominationsApi } from '../api';
import {
  AdministrativeNominationBilling,
  administrativeBillingQueryKey,
} from './AdministrativeNominationBilling';

interface Props {
  nominationId: string;
  reference: string;
  disabled: boolean;
  clientChangePending: boolean;
}

export function AdministrativeNominationInstructionsAction({
  nominationId,
  reference,
  disabled,
  clientChangePending,
}: Props) {
  const [billingOpen, setBillingOpen] = useState(false);
  const billingPending = useIsMutating({
    mutationKey: administrativeBillingQueryKey(nominationId),
  });
  const download = useMutation({
    mutationFn: () => nominationsApi.administrativeNominationInstructionsDocx(nominationId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reference.replace('/', '-')}-administrative-nomination-instructions.docx`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onError: (error) =>
      notifications.show({
        title: 'No se pudo descargar el documento administrativo',
        message: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        color: 'red',
      }),
  });

  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">
        Nomination Instructions Administrativo
      </Text>
      <Text size="xs" c="dimmed">
        SNCA-RG-AGN-002
      </Text>
      <Group gap="xs">
        <Button
          size="xs"
          variant="light"
          loading={download.isPending}
          disabled={clientChangePending || billingPending > 0}
          onClick={() => download.mutate()}
        >
          Descargar documento Word
        </Button>
        <Button size="xs" variant="default" onClick={() => setBillingOpen(true)}>
          {disabled ? 'Ver destinatarios de facturación' : 'Destinatarios de facturación'}
        </Button>
      </Group>
      <Modal
        opened={billingOpen}
        onClose={() => setBillingOpen(false)}
        title="Destinatarios de facturación"
        size="lg"
      >
        <AdministrativeNominationBilling nominationId={nominationId} disabled={disabled} />
      </Modal>
    </Stack>
  );
}
