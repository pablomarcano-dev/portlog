import type { ReactNode } from 'react';
import {
  AppShell as MantineAppShell,
  Group,
  Text,
  Badge,
  Button,
  Loader,
  Center,
  UnstyledButton,
} from '@mantine/core';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useCurrentUser, useLogout } from '../lib/auth/queries';

// Suppliers is a top-level nav entry (not in the MasterDataTabs strip) because
// it is a cross-cutting entity used across the PDA workflow rather than being
// owned by a single master-data tab group. Placing it here keeps the tab strip
// focused on entities managed exclusively inside Master Data.
const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Nominations', to: '/nominations' },
  { label: 'Vessels', to: '/vessels' },
  { label: 'Master Data', to: '/master-data/flags' },
  { label: 'Suppliers', to: '/master-data/suppliers' },
] as const;

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
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
          <Group gap="lg">
            <Text fw={600}>Portlog</Text>
            {NAV_LINKS.map((link) => {
              const isActive =
                link.to === '/'
                  ? currentPath === '/'
                  : // Suppliers uses an exact-prefix match so it doesn't also
                    // light up when any /master-data/* route is active.
                    link.to === '/master-data/suppliers'
                    ? currentPath.startsWith('/master-data/suppliers')
                    : currentPath.startsWith(link.to.split('/').slice(0, 2).join('/')) &&
                      !currentPath.startsWith('/master-data/suppliers');
              return (
                <UnstyledButton
                  key={link.to}
                  onClick={() => void navigate({ to: link.to })}
                  style={{
                    color: isActive ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-gray-7)',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: 'var(--mantine-font-size-sm)',
                    borderBottom: isActive
                      ? '2px solid var(--mantine-color-blue-6)'
                      : '2px solid transparent',
                    paddingBottom: 2,
                  }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {link.label}
                </UnstyledButton>
              );
            })}
          </Group>
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
