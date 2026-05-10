import { createFileRoute } from '@tanstack/react-router';
import { Stack, Title, Text } from '@mantine/core';
import { useCurrentUser } from '../../lib/auth/queries';

export const Route = createFileRoute('/_protected/')({
  component: HomePage,
});

function HomePage() {
  const { data: currentUser } = useCurrentUser();

  return (
    <Stack p="xl" gap="sm">
      <Title order={2}>Home</Title>
      {currentUser !== undefined && (
        <Text>
          Welcome, {currentUser.email} ({currentUser.role})
        </Text>
      )}
    </Stack>
  );
}
