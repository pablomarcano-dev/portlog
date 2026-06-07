import { useState } from 'react';
import { Stack, Text, Button, Divider, Tooltip } from '@mantine/core';
import { SofTimesheetModal } from './SofTimesheetModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionsPanelProps {
  /** Nomination id — used for building any nomination-scoped nav links */
  nominationId: string;
  /** Vessel name — for display context */
  vesselName?: string;
}

// ---------------------------------------------------------------------------
// Action definitions
// ---------------------------------------------------------------------------

interface HubAction {
  label: string;
  /** If true, the button is active and navigable */
  active: boolean;
  /** Called when button is clicked (only invoked if active) */
  onAction?: () => void;
  /** Tooltip text for disabled buttons */
  disabledReason?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActionsPanel({ nominationId, vesselName: _vesselName }: ActionsPanelProps) {
  const [sofOpen, setSofOpen] = useState(false);

  function scrollToShDocuments() {
    document.getElementById('sh-documents')?.scrollIntoView({ behavior: 'smooth' });
  }

  const actions: HubAction[] = [
    {
      label: 'PEDR',
      active: false,
      disabledReason: 'PEDR page coming soon',
    },
    {
      label: 'Statement of Facts',
      active: true,
      onAction: () => setSofOpen(true),
    },
    {
      label: 'SH Documents',
      active: true,
      onAction: scrollToShDocuments,
    },
    {
      label: 'All Sent',
      active: true,
      onAction: () =>
        document.getElementById('all-sent-section')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      label: 'Vessel Expense List',
      active: false,
      disabledReason: 'Coming soon',
    },
    {
      label: 'Prefunds Request',
      active: false,
      disabledReason: 'Coming soon',
    },
    {
      label: 'Crew Change',
      active: false,
      disabledReason: 'Coming soon',
    },
    {
      label: 'ISO Documents',
      active: false,
      disabledReason: 'Coming soon',
    },
    {
      label: 'Other Documents',
      active: false,
      disabledReason: 'Coming soon',
    },
    {
      label: 'Emails',
      active: false,
      disabledReason: 'Coming soon',
    },
  ];

  return (
    <>
      <Stack gap="xs">
        <Text fw={700} size="sm">
          Actions
        </Text>
        <Divider />

        {actions.map((action) =>
          action.active ? (
            <Button
              key={action.label}
              variant="light"
              size="xs"
              fullWidth
              onClick={action.onAction}
              styles={{ root: { justifyContent: 'flex-start' } }}
            >
              {action.label}
            </Button>
          ) : (
            <Tooltip
              key={action.label}
              label={action.disabledReason ?? 'Coming soon'}
              position="left"
              withArrow
            >
              <Button
                variant="subtle"
                size="xs"
                fullWidth
                disabled
                styles={{ root: { justifyContent: 'flex-start' } }}
              >
                {action.label}
              </Button>
            </Tooltip>
          ),
        )}
      </Stack>

      <SofTimesheetModal
        nominationId={nominationId}
        opened={sofOpen}
        onClose={() => setSofOpen(false)}
      />
    </>
  );
}
