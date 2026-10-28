import { useCallback, useEffect, useState } from 'react';
import { useCurrentUser } from '../../../lib/auth/queries';
import {
  readNominationDraft,
  saveNominationDraft,
  clearNominationDraft,
} from '../../../features/nominations/nominationDraft';
import { createFileRoute } from '@tanstack/react-router';
import { Alert, Button, Container, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { NominationForm } from '../../../features/nominations/components/NominationForm';
import { useCreateNomination } from '../../../features/nominations/hooks/useCreateNomination';
import type { NominationCreateInput } from '@portlog/schemas';

export const Route = createFileRoute('/_protected/nominations/new')({
  component: NewNominationPage,
});

function NewNominationPage() {
  const { data: user, isError: userError } = useCurrentUser();
  const [pending, setPending] = useState<Partial<NominationCreateInput> | null>(null);
  const [initial, setInitial] = useState<Partial<NominationCreateInput> | undefined>();
  const [ready, setReady] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (user) {
      try {
        const draft = readNominationDraft(localStorage, user.id);
        setPending(draft);
        setReady(!draft);
      } catch {
        setDraftError(
          'Local draft storage is unavailable. Keep this page open until you create the nomination.',
        );
        setReady(true);
      }
    }
  }, [user?.id]);
  const persistDraft = useCallback(
    (values: Partial<NominationCreateInput>) => {
      if (!user) return;
      try {
        saveNominationDraft(localStorage, user.id, values);
        setSaved(true);
        setDraftError('');
      } catch {
        setDraftError(
          'This browser could not save the pending nomination. Keep this page open until you create it.',
        );
      }
    },
    [user?.id],
  );
  const createNomination = useCreateNomination(() => {
    if (user) {
      try {
        clearNominationDraft(localStorage, user.id);
      } catch {
        /* Creation succeeded; storage failure must not block navigation. */
      }
    }
  });

  const handleSubmit = (vals: NominationCreateInput) => {
    createNomination.mutate(vals);
  };

  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <Title order={3}>New Nomination</Title>
        {createNomination.isError && (
          <Alert color="red" title="Error creating nomination">
            {createNomination.error instanceof Error
              ? createNomination.error.message
              : 'An unexpected error occurred.'}
          </Alert>
        )}
        {draftError && <Alert color="red">{draftError}</Alert>}
        {!user && !userError && <Loader size="sm" />}
        {userError && (
          <Alert color="red">
            Could not load your account. Reload to recover your local draft.
          </Alert>
        )}
        {pending && !ready && (
          <Alert title="Continue pending nomination" color="blue">
            <Text>
              A draft is saved in this browser for your account. It has not been submitted.
            </Text>
            <Group mt="sm">
              <Button
                onClick={() => {
                  setInitial(pending);
                  setReady(true);
                }}
              >
                Continue pending nomination
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  if (user) clearNominationDraft(localStorage, user.id);
                  setPending(null);
                  setInitial(undefined);
                  setReady(true);
                }}
              >
                Discard draft and start new
              </Button>
            </Group>
          </Alert>
        )}
        {ready && (
          <Text size="sm" c="dimmed">
            {saved
              ? 'Pending nomination saved locally in this browser. You can leave and continue it later.'
              : 'Your progress will be saved locally in this browser as you edit.'}
          </Text>
        )}
        {ready && (
          <NominationForm
            mode="create"
            defaultValues={initial}
            onDraftChange={persistDraft}
            onSubmit={handleSubmit}
            isSubmitting={createNomination.isPending}
          />
        )}
      </Stack>
    </Container>
  );
}
