import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { Center, Paper, Title, Stack } from '@mantine/core';
import { LoginForm } from '../components/LoginForm';
import { accessTokenStore } from '../lib/auth/accessTokenStore';

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  beforeLoad() {
    if (accessTokenStore.get() !== null) {
      throw redirect({ to: '/' });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <Center h="100vh">
      <Paper shadow="sm" p="xl" w={360}>
        <Stack gap="lg">
          <Title order={2}>Sign in</Title>
          <LoginForm />
        </Stack>
      </Paper>
    </Center>
  );
}
