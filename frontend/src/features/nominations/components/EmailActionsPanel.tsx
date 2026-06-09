import { useState, useEffect } from 'react';
import { Stack, Text, Button, Divider } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { NominationParcelRead, SubDocType } from '@portlog/schemas';
import { EmailComposeDrawer } from './EmailComposeDrawer';
import { EtaAnswerModal } from './EtaAnswerModal';
import { CargoUpdateModal } from './CargoUpdateModal';
import { SofTimesheetModal } from './SofTimesheetModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailActionsPanelProps {
  nominationId: string;
  opPortId?: string | null;
  pedrId: string;
  vesselName?: string;
  parcels?: NominationParcelRead[];
  /** When set, immediately opens the drawer for this sub-doc type */
  externalOpen?: SubDocType | null;
  /** Called after the externally-triggered drawer is opened (so caller can clear externalOpen) */
  onExternalOpenHandled?: () => void;
}

// ---------------------------------------------------------------------------
// Sub-document action button definitions
// ---------------------------------------------------------------------------

interface SubDocAction {
  type: SubDocType | 'ETA';
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
    // ETA opens the two-step EtaAnswerModal, not a direct compose drawer
    type: 'ETA',
    label: 'E.T.A.',
    subjectTemplate: () => '',
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
  parcels = [],
  externalOpen,
  onExternalOpenHandled,
}: EmailActionsPanelProps) {
  const [activeDrawer, setActiveDrawer] = useState<SubDocType | null>(null);
  const [etaOpen, setEtaOpen] = useState(false);
  const [cargoUpdateOpen, setCargoUpdateOpen] = useState(false);
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

  function handleActionClick(type: SubDocAction['type']) {
    if (type === 'ETA') {
      setEtaOpen(true);
    } else if (type === 'CARGO_UPDATE') {
      setCargoUpdateOpen(true);
    } else if (type === 'SOF') {
      openSof();
    } else {
      setActiveDrawer(type as SubDocType);
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
            onClick={() => !action.future && handleActionClick(action.type)}
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
      </Stack>

      {/* ETA — two-step Answer ETA modal */}
      <EtaAnswerModal
        opened={etaOpen}
        onClose={() => setEtaOpen(false)}
        nominationId={nominationId}
        pedrId={pedrId}
        vesselName={vesselName}
      />

      {/* Cargo Update — editable parcel table modal */}
      <CargoUpdateModal
        opened={cargoUpdateOpen}
        onClose={() => setCargoUpdateOpen(false)}
        nominationId={nominationId}
        initialParcels={parcels}
      />

      {/* Compose drawer — for all other actions */}
      {activeAction && activeAction.type !== 'ETA' && activeAction.type !== 'CARGO_UPDATE' && (
        <EmailComposeDrawer
          opened={activeDrawer !== null}
          onClose={closeDrawer}
          pedrId={pedrId}
          nominationId={nominationId}
          subDocType={activeAction.type as SubDocType}
          defaultSubject={activeAction.subjectTemplate(vesselName)}
        />
      )}

      <SofTimesheetModal
        nominationId={nominationId}
        pedrId={pedrId}
        opPortId={opPortId}
        opened={sofOpened}
        onClose={closeSof}
      />
    </>
  );
}
