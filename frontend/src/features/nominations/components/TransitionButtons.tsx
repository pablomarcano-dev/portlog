import { useState } from 'react';
import { Alert, Button, Group, Modal, Textarea, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { ALLOWED_TRANSITIONS } from '@portlog/schemas';
import type { NominationStatus } from '@portlog/schemas';
import { useTransitionNomination } from '../hooks/useTransitionNomination';

interface TransitionButtonsProps {
  nominationId: string;
  currentStatus: NominationStatus;
}

function buttonColor(status: NominationStatus): string {
  switch (status) {
    case 'CONFIRMED':
      return 'blue';
    case 'IN_PROGRESS':
      return 'teal';
    case 'COMPLETED':
      return 'green';
    case 'CANCELLED':
      return 'red';
    default:
      return 'gray';
  }
}

function buttonLabel(status: NominationStatus): string {
  switch (status) {
    case 'CONFIRMED':
      return 'Confirm';
    case 'IN_PROGRESS':
      return 'Start';
    case 'COMPLETED':
      return 'Complete';
    case 'CANCELLED':
      return 'Cancel';
    default:
      return status;
  }
}

export function TransitionButtons({ nominationId, currentStatus }: TransitionButtonsProps) {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  const transition = useTransitionNomination(nominationId);
  const [cancelOpened, { open: openCancel, close: closeCancel }] = useDisclosure(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);

  if (allowed.length === 0) {
    return (
      <Alert color="gray" variant="light">
        This nomination is closed.
      </Alert>
    );
  }

  const handleTransition = (toStatus: NominationStatus) => {
    if (toStatus === 'CANCELLED') {
      openCancel();
      return;
    }
    transition.mutate({ toStatus });
  };

  const handleCancelSubmit = () => {
    if (reason.trim().length === 0) {
      setReasonError('A reason is required when cancelling.');
      return;
    }
    setReasonError(undefined);
    transition.mutate(
      { toStatus: 'CANCELLED', reason: reason.trim() },
      {
        onSuccess: () => {
          closeCancel();
          setReason('');
        },
      },
    );
  };

  const handleModalClose = () => {
    closeCancel();
    setReason('');
    setReasonError(undefined);
  };

  return (
    <>
      <Group gap="xs">
        {allowed.map((toStatus) => (
          <Button
            key={toStatus}
            color={buttonColor(toStatus)}
            variant={toStatus === 'CANCELLED' ? 'outline' : 'filled'}
            loading={transition.isPending}
            onClick={() => handleTransition(toStatus)}
          >
            {buttonLabel(toStatus)}
          </Button>
        ))}
      </Group>

      <Modal
        opened={cancelOpened}
        onClose={handleModalClose}
        title={<Text fw={600}>Cancel Nomination</Text>}
        centered
      >
        <Textarea
          label="Reason for cancellation"
          placeholder="Provide a reason..."
          required
          minRows={3}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          error={reasonError}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={handleModalClose}>
            Back
          </Button>
          <Button color="red" loading={transition.isPending} onClick={handleCancelSubmit}>
            Confirm Cancellation
          </Button>
        </Group>
      </Modal>
    </>
  );
}
