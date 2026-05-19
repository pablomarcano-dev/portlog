import { Stack, Text, UnstyledButton, Tooltip, NavLink } from '@mantine/core';

interface NavItem {
  label: string;
  slug: string | undefined;
  enabled: boolean;
  since?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Nomination Info', slug: undefined, enabled: true },
  { label: 'Acknowledgement', slug: 'acknowledgement', enabled: false, since: 'M4' },
  { label: 'Prearrival', slug: 'prearrival', enabled: false, since: 'M4' },
  { label: "ETA's / ETB's", slug: 'eta', enabled: false, since: 'M4' },
  { label: 'S.O.F.', slug: 'sof', enabled: false, since: 'M4' },
  { label: 'Cargo Update', slug: 'cargo-update', enabled: false, since: 'M4' },
  { label: 'N.O.R.', slug: 'nor', enabled: false, since: 'M4' },
  { label: 'Final D/A Info', slug: 'fda', enabled: false, since: 'M6' },
  { label: 'All Sent', slug: 'all-sent', enabled: false, since: 'M5' },
];

export function MessagesNav() {
  return (
    <Stack gap={2} w={200} py="sm">
      <Text size="xs" fw={700} tt="uppercase" c="dimmed" px="sm" mb={4}>
        Messages
      </Text>
      {NAV_ITEMS.map((item) => {
        if (item.enabled) {
          return <NavLink key={item.label} label={item.label} active variant="filled" />;
        }

        return (
          <Tooltip
            key={item.label}
            label={`Available in ${item.since ?? 'a future milestone'}`}
            position="right"
            withArrow
          >
            <UnstyledButton
              px="sm"
              py={6}
              style={{ opacity: 0.5, cursor: 'not-allowed', width: '100%' }}
            >
              <Text size="sm">{item.label}</Text>
            </UnstyledButton>
          </Tooltip>
        );
      })}
    </Stack>
  );
}
