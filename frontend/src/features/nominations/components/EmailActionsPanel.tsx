import { useState, useEffect } from 'react';
import { Stack, Text, Button, Divider, Loader, Box, Badge, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { SubDocType } from '@portlog/schemas';
import { EmailComposeDrawer } from './EmailComposeDrawer';
import { SofTimesheetModal } from './SofTimesheetModal';
import { useDispatchLog } from '../api/useDispatchLog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailActionsPanelProps {
  nominationId: string;
  opPortId?: string | null;
  pedrId: string;
  vesselName?: string;
  /** When set, immediately opens the drawer for this sub-doc type */
  externalOpen?: SubDocType | null;
  /** Called after the externally-triggered drawer is opened (so caller can clear externalOpen) */
  onExternalOpenHandled?: () => void;
}

// ---------------------------------------------------------------------------
// Sub-document action button definitions
// ---------------------------------------------------------------------------

interface SubDocAction {
  type: SubDocType;
  label: string;
  subjectTemplate: (vesselName: string) => string;
  /** Stories beyond M4-S6 that have not been wired yet */
  future?: boolean;
}

const ACTIONS: SubDocAction[] = [
  {
    type: 'ACKNOWLEDGEMENT',
    label: 'Acknowledgement',
    subjectTemplate: (v) => `Acknowledgement of Nomination — ${v}`,
  },
  {
    type: 'PREARRIVAL',
    label: 'Prearrival',
    subjectTemplate: (v) => `Pre-Arrival Notification — ${v}`,
  },
  {
    type: 'ETA_ETB',
    label: 'E.T.A.',
    subjectTemplate: (v) => `ETA/ETB Notice — ${v}`,
  },
  {
    type: 'CARGO_UPDATE',
    label: 'Cargo Update',
    subjectTemplate: (v) => `Cargo Update — ${v}`,
  },
  {
    type: 'SOF',
    label: 'Statement of Facts',
    subjectTemplate: (v) => `Statement of Facts — ${v}`,
  },
  {
    type: 'NOR',
    label: 'NOR',
    subjectTemplate: (v) => `Notice of Readiness — ${v}`,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmailActionsPanel({
  nominationId,
  opPortId,
  pedrId,
  vesselName = '',
  externalOpen,
  onExternalOpenHandled,
}: EmailActionsPanelProps) {
  const [activeDrawer, setActiveDrawer] = useState<SubDocType | null>(null);
  const [sofOpened, { open: openSof, close: closeSof }] = useDisclosure(false);

  useEffect(() => {
    if (externalOpen) {
      if (externalOpen === 'SOF') {
        openSof();
      } else {
        setActiveDrawer(externalOpen);
      }
      onExternalOpenHandled?.();
    }
  }, [externalOpen, onExternalOpenHandled, openSof]);
  const dispatchLog = useDispatchLog(pedrId);

  function openDrawer(type: SubDocType) {
    if (type === 'SOF') {
      openSof();
    } else {
      setActiveDrawer(type);
    }
  }

  function closeDrawer() {
    setActiveDrawer(null);
  }

  const activeAction = ACTIONS.find((a) => a.type === activeDrawer);

  return (
    <>
      <Stack gap="xs">
        <Text fw={700} size="sm">
          Actions
        </Text>
        <Divider />

        {ACTIONS.map((action) => (
          <Button
            key={action.type}
            variant="light"
            size="xs"
            fullWidth
            disabled={action.future}
            onClick={() => !action.future && openDrawer(action.type)}
            styles={{ root: { justifyContent: 'flex-start' } }}
          >
            {action.label}
            {action.future && (
              <Text component="span" size="xs" c="dimmed" ml={4}>
                (soon)
              </Text>
            )}
          </Button>
        ))}

        <Divider />

        {/* Dispatch log summary */}
        <Text fw={600} size="xs" c="dimmed">
          Sent Emails
        </Text>

        {dispatchLog.isLoading && (
          <Box ta="center">
            <Loader size="xs" />
          </Box>
        )}

        {dispatchLog.data?.items.length === 0 && (
          <Text size="xs" c="dimmed">
            No emails sent yet.
          </Text>
        )}

        {dispatchLog.data?.items.map((d) => (
          <Box
            key={d.id}
            style={{
              padding: '6px 8px',
              borderRadius: 4,
              background: 'var(--mantine-color-gray-0)',
            }}
          >
            <Group gap={4} justify="space-between">
              <Text size="xs" fw={500}>
                {d.subDocType.replace(/_/g, ' ')}
              </Text>
              <Badge size="xs" color={d.sentAt ? 'green' : d.error ? 'red' : 'gray'}>
                {d.sentAt ? 'Sent' : d.error ? 'Error' : 'Pending'}
              </Badge>
            </Group>
            {d.sentAt && (
              <Text size="xs" c="dimmed">
                {new Date(d.sentAt).toLocaleString()}
              </Text>
            )}
          </Box>
        ))}
      </Stack>

      {/* Compose drawer — rendered once, parameterized by activeAction */}
      {activeAction && (
        <EmailComposeDrawer
          opened={activeDrawer !== null}
          onClose={closeDrawer}
          pedrId={pedrId}
          subDocType={activeAction.type}
          defaultSubject={activeAction.subjectTemplate(vesselName)}
        />
      )}

      <SofTimesheetModal
        nominationId={nominationId}
        opPortId={opPortId}
        opened={sofOpened}
        onClose={closeSof}
      />
    </>
  );
}
