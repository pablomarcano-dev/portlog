import { createFileRoute } from '@tanstack/react-router';
import { Alert, Container, Stack, Title } from '@mantine/core';
import { NominationForm } from '../../../features/nominations/components/NominationForm';
import { useCreateNomination } from '../../../features/nominations/hooks/useCreateNomination';
import type { NominationCreateInput } from '@portlog/schemas';

export const Route = createFileRoute('/_protected/nominations/new')({
  component: NewNominationPage,
});

function NewNominationPage() {
  const createNomination = useCreateNomination();

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
        <NominationForm
          mode="create"
          onSubmit={handleSubmit}
          isSubmitting={createNomination.isPending}
        />
      </Stack>
    </Container>
  );
}
