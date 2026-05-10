import type { ReactNode } from 'react';
import {
  AppShell as MantineAppShell,
  Group,
  Text,
  Badge,
  Button,
  Loader,
  Center,
} from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { useCurrentUser, useLogout } from '../lib/auth/queries';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const { data: currentUser, isPending } = useCurrentUser();
  const logout = useLogout();

  async function handleLogout() {
    await logout.mutateAsync();
    await navigate({ to: '/login' });
  }

  if (isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  return (
    <MantineAppShell header={{ height: 56 }}>
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={600}>Portlog</Text>
          <Group gap="sm">
            {currentUser !== undefined && (
              <>
                <Text size="sm">{currentUser.email}</Text>
                <Badge variant="light">{currentUser.role}</Badge>
              </>
            )}
            <Button
              variant="subtle"
              size="sm"
              loading={logout.isPending}
              onClick={() => void handleLogout()}
            >
              Logout
            </Button>
          </Group>
        </Group>
      </MantineAppShell.Header>
      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  );
}
