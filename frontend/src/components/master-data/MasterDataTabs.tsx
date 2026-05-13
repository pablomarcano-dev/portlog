import { useRouterState, useNavigate } from '@tanstack/react-router';
import { Group, Text, UnstyledButton } from '@mantine/core';

interface TabDef {
  label: string;
  path: string;
}

/**
 * The 10-entity tab strip for the Data Base / master-data section.
 * Active tab is derived from the current route pathname so it stays in sync
 * with browser navigation. Owner and Supplier are separate routes (not tabs).
 */
const TABS: TabDef[] = [
  { label: 'Ship Particulars', path: '/master-data/ship-particulars' },
  { label: 'Flags', path: '/master-data/flags' },
  { label: 'Activities', path: '/master-data/activities' },
  { label: 'Cargoes', path: '/master-data/cargoes' },
  { label: 'Ports', path: '/master-data/ports' },
  { label: 'Charterers', path: '/master-data/charterers' },
  { label: 'Shippers', path: '/master-data/shippers' },
  { label: 'Agents', path: '/master-data/agents' },
  { label: 'Operators', path: '/master-data/operators' },
  { label: 'Contacts', path: '/master-data/contacts' },
  { label: 'Email Groups', path: '/master-data/email-groups' },
];

export function MasterDataTabs() {
  const routerState = useRouterState();
  const navigate = useNavigate();
  const currentPath = routerState.location.pathname;

  return (
    <Group
      gap={0}
      style={{
        borderBottom: '1px solid var(--mantine-color-gray-3)',
        overflowX: 'auto',
        flexWrap: 'nowrap',
      }}
    >
      {TABS.map((tab) => {
        const isActive = currentPath.startsWith(tab.path);
        return (
          <UnstyledButton
            key={tab.path}
            px="md"
            py="sm"
            style={{
              borderBottom: isActive
                ? '2px solid var(--mantine-color-blue-6)'
                : '2px solid transparent',
              color: isActive ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-gray-7)',
              whiteSpace: 'nowrap',
            }}
            onClick={() => void navigate({ to: tab.path as '/' })}
            aria-current={isActive ? 'page' : undefined}
          >
            <Text size="sm" fw={isActive ? 600 : 400}>
              {tab.label}
            </Text>
          </UnstyledButton>
        );
      })}
    </Group>
  );
}
