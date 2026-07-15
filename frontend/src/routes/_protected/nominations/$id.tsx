import { createFileRoute } from '@tanstack/react-router';
import {
  Alert,
  Badge,
  Box,
  Button,
  Collapse,
  Container,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useState } from 'react';
import { NominationForm } from '../../../features/nominations/components/NominationForm';
import { TransitionButtons } from '../../../features/nominations/components/TransitionButtons';
import { StatusHistoryTimeline } from '../../../features/nominations/components/StatusHistoryTimeline';
import { MessagesPanel } from '../../../features/nominations/components/MessagesPanel';
import { BranchDocumentsPanel } from '../../../features/branch-documents';
import { EmailActionsPanel } from '../../../features/nominations/components/EmailActionsPanel';
import { ClientsSection } from '../../../features/nominations/components/ClientsSection';
import { SalesModal } from '../../../features/nominations/components/SalesModal';
import { useNomination } from '../../../features/nominations/hooks/useNomination';
import { useUpdateNomination } from '../../../features/nominations/hooks/useUpdateNomination';
import { usePedrByNomination } from '../../../features/nominations/api/usePedrByNomination';
import type { NominationCreateInput, NominationStatus, NominationParcel } from '@portlog/schemas';

export const Route = createFileRoute('/_protected/nominations/$id')({
  component: NominationDetailPage,
});

const TERMINAL_STATUSES: NominationStatus[] = ['COMPLETED', 'CANCELLED'];

const STATUS_COLORS: Record<NominationStatus, string> = {
  DRAFT: 'gray',
  CONFIRMED: 'blue',
  IN_PROGRESS: 'teal',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

function NominationDetailPage() {
  const { id } = Route.useParams();
  const { data: nomination, isLoading, isError, error } = useNomination(id);
  const updateNomination = useUpdateNomination(id);
  const { data: pedr } = usePedrByNomination(id);
  const [rightOpen, setRightOpen] = useState(true);
  const [formOpen, setFormOpen] = useState(true);
  const [clientsOpen, setClientsOpen] = useState(true);
  const [messagesOpen, setMessagesOpen] = useState(true);
  const [branchDocsOpen, setBranchDocsOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(true);
  const [salesOpen, setSalesOpen] = useState(false);

  if (isLoading) {
    return (
      <Container py="xl">
        <Loader />
      </Container>
    );
  }

  if (isError || nomination === undefined) {
    return (
      <Container py="xl">
        <Alert color="red" title="Failed to load nomination">
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </Alert>
      </Container>
    );
  }

  const isReadOnly = TERMINAL_STATUSES.includes(nomination.status);

  const defaultValues: Partial<NominationCreateInput> = {
    shipParticularId: nomination.shipParticularId,
    branchId: nomination.branchId ?? undefined,
    nomReply: nomination.nomReply ?? undefined,
    externalPortId: nomination.externalPortId ?? undefined,
    mobileOnBoard: nomination.mobileOnBoard ?? undefined,
    referenceNo: nomination.referenceNo ?? undefined,
    contactBlackBerry: nomination.contactBlackBerry ?? undefined,
    blindCopy: nomination.blindCopy ?? undefined,
    emailTo: nomination.emailTo ?? [],
    emailCc: nomination.emailCc ?? [],
    emailBcc: nomination.emailBcc ?? [],
    opPortId: nomination.opPortId ?? undefined,
    pierId: nomination.pierId ?? undefined,
    lastPortId: nomination.lastPortId ?? undefined,
    nextPortId: nomination.nextPortId ?? undefined,
    disPortId: nomination.disPortId ?? undefined,
    dateNominated: nomination.dateNominated,
    layDaysFirst: nomination.layDaysFirst ?? undefined,
    layDaysLast: nomination.layDaysLast ?? undefined,
    etaDate: nomination.etaDate ?? undefined,
    nominatedById: nomination.nominatedById ?? undefined,
    master: nomination.master ?? undefined,
    mic: nomination.mic ?? undefined,
    broker: nomination.broker ?? undefined,
    boardingClerk: nomination.boardingClerk ?? undefined,
    inspector: nomination.inspector ?? undefined,
    nominationType: nomination.nominationType,
    subject: nomination.subject ?? undefined,
    parcels: (nomination.parcels ?? []).filter(
      (f): f is NominationParcel =>
        typeof f.quantity === 'number' && typeof f.operation === 'string',
    ),
  };

  const handleUpdate = (vals: NominationCreateInput) => {
    updateNomination.mutate(vals);
  };

  return (
    <Box style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Main content */}
      <Box style={{ flex: 1, overflowY: 'auto' }}>
        <Container size="xl" py="lg">
          <Stack gap="md">
            {/* Header */}
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Title order={3}>
                  Nomination #{nomination.correlative} — {nomination.voyageNumber}
                </Title>
                <Group gap="xs">
                  <Text size="sm" c="dimmed">
                    {nomination.shipParticular.name}
                  </Text>
                  <Badge color={STATUS_COLORS[nomination.status]}>{nomination.status}</Badge>
                </Group>
              </Stack>
              <Group gap="xs">
                {/* Sales stay accessible in terminal statuses — billing happens after ops complete */}
                <Button variant="light" size="xs" onClick={() => setSalesOpen(true)}>
                  Sales
                </Button>
                <TransitionButtons nominationId={nomination.id} currentStatus={nomination.status} />
              </Group>
            </Group>

            <SalesModal
              opened={salesOpen}
              onClose={() => setSalesOpen(false)}
              nominationId={nomination.id}
              correlative={nomination.correlative}
            />

            <Divider />

            {updateNomination.isError && (
              <Alert color="red" title="Error saving nomination">
                {updateNomination.error instanceof Error
                  ? updateNomination.error.message
                  : 'An unexpected error occurred.'}
              </Alert>
            )}

            {/* Nomination form — collapsible */}
            <Stack gap={0}>
              <UnstyledButton
                onClick={() => setFormOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  userSelect: 'none',
                }}
              >
                <Title order={5}>Nomination Details</Title>
                <Text size="xs" c="dimmed">
                  {formOpen ? '▲' : '▼'}
                </Text>
              </UnstyledButton>
              <Collapse in={formOpen}>
                <Box pt="xs">
                  <NominationForm
                    mode="edit"
                    defaultValues={defaultValues}
                    onSubmit={handleUpdate}
                    isSubmitting={updateNomination.isPending}
                    isReadOnly={isReadOnly}
                    correlative={nomination.correlative}
                  />
                </Box>
              </Collapse>
            </Stack>

            <Divider />

            {/* Client list section — collapsible */}
            <Stack gap={0}>
              <UnstyledButton
                onClick={() => setClientsOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  userSelect: 'none',
                }}
              >
                <Title order={5}>Clients</Title>
                <Text size="xs" c="dimmed">
                  {clientsOpen ? '▲' : '▼'}
                </Text>
              </UnstyledButton>
              <Collapse in={clientsOpen}>
                <Box pt="xs">
                  <ClientsSection nominationId={id} />
                </Box>
              </Collapse>
            </Stack>

            <Divider />

            {/* Branch Documents section — collapsible */}
            {nomination.branchId && (
              <Stack gap={0}>
                <UnstyledButton
                  onClick={() => setBranchDocsOpen((o) => !o)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    userSelect: 'none',
                  }}
                >
                  <Title order={5}>Branch Documents</Title>
                  <Text size="xs" c="dimmed">
                    {branchDocsOpen ? '▲' : '▼'}
                  </Text>
                </UnstyledButton>
                <Collapse in={branchDocsOpen}>
                  <Box pt="xs">
                    <BranchDocumentsPanel nomination={nomination} />
                  </Box>
                </Collapse>
              </Stack>
            )}

            <Divider />

            {/* Messages section — collapsible */}
            <Stack gap={0} id="messages-section">
              <UnstyledButton
                onClick={() => setMessagesOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  userSelect: 'none',
                }}
              >
                <Title order={5}>Messages</Title>
                <Text size="xs" c="dimmed">
                  {messagesOpen ? '▲' : '▼'}
                </Text>
              </UnstyledButton>
              <Collapse in={messagesOpen}>
                <Box pt="xs">
                  <MessagesPanel nominationId={id} />
                </Box>
              </Collapse>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Right rail: Save button + hub actions + status history + email actions */}
      <Box
        style={{
          width: rightOpen ? 280 : 42,
          borderLeft: '1px solid var(--mantine-color-gray-3)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 150ms ease',
        }}
      >
        {/* Toggle + Save button row — always visible */}
        <Box
          style={{
            padding: '8px',
            borderBottom: '1px solid var(--mantine-color-gray-3)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <UnstyledButton
            onClick={() => setRightOpen((o) => !o)}
            style={{
              fontSize: 12,
              color: 'var(--mantine-color-dimmed)',
              flexShrink: 0,
            }}
          >
            {rightOpen ? '▶' : '◀'}
          </UnstyledButton>
          {!isReadOnly && (
            <Button
              size="xs"
              form="nomination-form"
              type="submit"
              loading={updateNomination.isPending}
              style={{ flex: 1, display: rightOpen ? undefined : 'none' }}
            >
              Save Changes
            </Button>
          )}
        </Box>

        {/* Scrollable right rail content */}
        {rightOpen && (
          <Box style={{ overflowY: 'auto', flex: 1, padding: 'var(--mantine-spacing-md)' }}>
            {/* Status History — collapsible */}
            <Stack gap={0} mb="md">
              <UnstyledButton
                onClick={() => setHistoryOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  userSelect: 'none',
                }}
              >
                <Text fw={700} size="sm">
                  Status History
                </Text>
                <Text size="xs" c="dimmed">
                  {historyOpen ? '▲' : '▼'}
                </Text>
              </UnstyledButton>
              <Collapse in={historyOpen}>
                <Box pt="xs">
                  <StatusHistoryTimeline history={nomination.statusHistory} />
                </Box>
              </Collapse>
            </Stack>

            {/* Actions — shown once a PEDR exists (auto-created when the nomination is Started) */}
            {pedr && (
              <>
                <Divider my="sm" />
                <Stack gap={0}>
                  <UnstyledButton
                    onClick={() => setActionsOpen((o) => !o)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      userSelect: 'none',
                    }}
                  >
                    <Text fw={700} size="sm">
                      Actions
                    </Text>
                    <Text size="xs" c="dimmed">
                      {actionsOpen ? '▲' : '▼'}
                    </Text>
                  </UnstyledButton>
                  <Collapse in={actionsOpen}>
                    <Box pt="xs">
                      <EmailActionsPanel
                        nominationId={nomination.id}
                        opPortId={nomination.opPortId}
                        pedrId={pedr.id}
                        vesselName={nomination.shipParticular.name}
                        parcels={nomination.parcels as NominationParcel[]}
                      />
                    </Box>
                  </Collapse>
                </Stack>
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
