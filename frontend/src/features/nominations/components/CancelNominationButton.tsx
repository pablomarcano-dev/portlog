import { useState } from 'react';
import { Button, Group, Modal, Textarea, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { NominationStatus } from '@portlog/schemas';
import { useTransitionNomination } from '../hooks/useTransitionNomination';

interface CancelNominationButtonProps {
  nominationId: string;
  currentStatus: NominationStatus;
}

// Status advances automatically (Nominated → In Port → Full Away); the only manual
// action is cancelling, which requires a reason and is a one-way override.
export function CancelNominationButton({
  nominationId,
  currentStatus,
}: CancelNominationButtonProps) {
  const transition = useTransitionNomination(nominationId);
  const [opened, { open, close }] = useDisclosure(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);

  if (currentStatus === 'CANCELLED') return null;

  const handleSubmit = () => {
    if (reason.trim().length === 0) {
      setReasonError('A reason is required when cancelling.');
      return;
    }
    setReasonError(undefined);
    transition.mutate(
      { toStatus: 'CANCELLED', reason: reason.trim() },
      {
        onSuccess: () => {
          close();
          setReason('');
        },
      },
    );
  };

  const handleClose = () => {
    close();
    setReason('');
    setReasonError(undefined);
  };

  return (
    <>
      <Button color="red" variant="outline" loading={transition.isPending} onClick={open}>
        Cancel
      </Button>

      <Modal
        opened={opened}
        onClose={handleClose}
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
          <Button variant="default" onClick={handleClose}>
            Back
          </Button>
          <Button color="red" loading={transition.isPending} onClick={handleSubmit}>
            Confirm Cancellation
          </Button>
        </Group>
      </Modal>
    </>
  );
}
