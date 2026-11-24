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
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useState } from 'react';
import { NominationForm } from '../../../features/nominations/components/NominationForm';
import { NominationSectionHeader } from '../../../features/nominations/components/NominationSectionHeader';
import { CancelNominationButton } from '../../../features/nominations/components/CancelNominationButton';
import { StatusHistoryTimeline } from '../../../features/nominations/components/StatusHistoryTimeline';
import { MessagesPanel } from '../../../features/nominations/components/MessagesPanel';
import { BranchDocumentsPanel } from '../../../features/branch-documents';
import { EmailActionsPanel } from '../../../features/nominations/components/EmailActionsPanel';
import { ClientsSection } from '../../../features/nominations/components/ClientsSection';
import { NominationInstructionsAction } from '../../../features/nominations/components/NominationInstructionsAction';
import { useNomination } from '../../../features/nominations/hooks/useNomination';
import { useUpdateNomination } from '../../../features/nominations/hooks/useUpdateNomination';
import { usePedrByNomination } from '../../../features/nominations/api/usePedrByNomination';
import type { NominationCreateInput, NominationStatus, NominationParcel } from '@portlog/schemas';

export const Route = createFileRoute('/_protected/nominations/$id')({
  component: NominationDetailPage,
});

const STATUS_COLORS: Record<NominationStatus, string> = {
  NOMINATED: 'blue',
  IN_PORT: 'teal',
  FULL_AWAY: 'green',
  CANCELLED: 'red',
};

function NominationDetailPage() {
  const { id } = Route.useParams();
  // Reset local sections and form drafts only when navigating to another call.
  // Query refreshes and saves keep the current page mounted and its edits intact.
  return <NominationDetail key={id} id={id} />;
}

function NominationDetail({ id }: { id: string }) {
  const { data: nomination, isLoading, isError, error } = useNomination(id);
  const updateNomination = useUpdateNomination(id);
  const { data: pedr } = usePedrByNomination(id);
  const [rightOpen, setRightOpen] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [branchDocsOpen, setBranchDocsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

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

  const isReadOnly = nomination.status === 'CANCELLED';
  const businessReference = nomination.administrativeSnOt?.trim() || nomination.snOt;

  const defaultValues: Partial<NominationCreateInput> = {
    shipParticularId: nomination.shipParticularId,
    branchId: nomination.branchId ?? undefined,
    chartererId: nomination.chartererId,
    nomReply: nomination.nomReply ?? undefined,
    mobileOnBoard: nomination.mobileOnBoard ?? undefined,
    referenceNo: nomination.referenceNo ?? undefined,
    vesselVoyageNumber: nomination.vesselVoyageNumber ?? '',
    administrativeSnOt: nomination.administrativeSnOt,
    sdwt: nomination.sdwt ?? nomination.shipParticular.dwt ?? undefined,
    grt: nomination.grt ?? nomination.shipParticular.grt ?? undefined,
    loa: nomination.loa ?? nomination.shipParticular.loa ?? undefined,
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
    masterContactId: nomination.masterContactId,
    firstMessageGroupId: nomination.firstMessageGroupId,
    secondMessageGroupId: nomination.secondMessageGroupId,
    thirdMessageGroupId: nomination.thirdMessageGroupId,
    alwaysCopyGroupId: nomination.alwaysCopyGroupId,
    master: nomination.master ?? undefined,
    mic: nomination.mic ?? undefined,
    broker: nomination.broker ?? undefined,
    boardingClerk: nomination.boardingClerk ?? undefined,
    inspector: nomination.inspector ?? undefined,
    nominationType: nomination.nominationType,
    kind: nomination.kind,
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
              <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                <Title order={3} style={{ overflowWrap: 'anywhere' }}>
                  {nomination.shipParticular.name}
                </Title>
                <Group gap="xs">
                  <Badge
                    size="lg"
                    radius="sm"
                    variant="outline"
                    color={nomination.kind === 'OT' ? 'grape' : 'blue'}
                    style={{ maxWidth: '100%', height: 'auto', paddingBlock: 4 }}
                    styles={{ label: { whiteSpace: 'normal', overflowWrap: 'anywhere' } }}
                  >
                    {businessReference}
                  </Badge>
                  <Badge color={STATUS_COLORS[nomination.status]}>{nomination.status}</Badge>
                </Group>
              </Stack>
              <Group gap="xs" style={{ flexShrink: 0 }}>
                <CancelNominationButton
                  nominationId={nomination.id}
                  currentStatus={nomination.status}
                />
              </Group>
            </Group>

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
              <NominationSectionHeader
                label="Nomination Details"
                expanded={formOpen}
                controls="nomination-details-content"
                onToggle={() => setFormOpen((o) => !o)}
              />
              <Collapse id="nomination-details-content" in={formOpen}>
                <Box pt="xs">
                  <NominationForm
                    nominationId={id}
                    mode="edit"
                    defaultValues={defaultValues}
                    onSubmit={handleUpdate}
                    isSubmitting={updateNomination.isPending}
                    isReadOnly={isReadOnly}
                    correlative={nomination.correlative}
                    masterContactOption={
                      nomination.masterContact
                        ? {
                            value: nomination.masterContact.id,
                            label: nomination.masterContact.name,
                          }
                        : null
                    }
                    routingOptions={{
                      firstMessageGroupId: nomination.firstMessageGroup
                        ? {
                            value: nomination.firstMessageGroup.id,
                            label: nomination.firstMessageGroup.name,
                          }
                        : null,
                      secondMessageGroupId: nomination.secondMessageGroup
                        ? {
                            value: nomination.secondMessageGroup.id,
                            label: nomination.secondMessageGroup.name,
                          }
                        : null,
                      thirdMessageGroupId: nomination.thirdMessageGroup
                        ? {
                            value: nomination.thirdMessageGroup.id,
                            label: nomination.thirdMessageGroup.name,
                          }
                        : null,
                      alwaysCopyGroupId: nomination.alwaysCopyGroup
                        ? {
                            value: nomination.alwaysCopyGroup.id,
                            label: nomination.alwaysCopyGroup.name,
                          }
                        : null,
                    }}
                    chartererOption={
                      nomination.charterer
                        ? { value: nomination.charterer.id, label: nomination.charterer.name }
                        : null
                    }
                    opPortOption={
                      nomination.opPort
                        ? { value: nomination.opPort.id, label: nomination.opPort.name }
                        : null
                    }
                    pierOption={
                      nomination.pier
                        ? { value: nomination.pier.id, label: nomination.pier.name }
                        : null
                    }
                    lastPortOption={
                      nomination.lastPort
                        ? { value: nomination.lastPort.id, label: nomination.lastPort.name }
                        : null
                    }
                    nextPortOption={
                      nomination.nextPort
                        ? { value: nomination.nextPort.id, label: nomination.nextPort.name }
                        : null
                    }
                  />
                </Box>
              </Collapse>
            </Stack>

            <Divider />

            {/* Client list section — collapsible */}
            <Stack gap={0}>
              <NominationSectionHeader
                label="Clients"
                expanded={clientsOpen}
                controls="nomination-clients-content"
                onToggle={() => setClientsOpen((o) => !o)}
              />
              <Collapse id="nomination-clients-content" in={clientsOpen}>
                <Box pt="xs">
                  <ClientsSection nominationId={id} />
                </Box>
              </Collapse>
            </Stack>

            <Divider />

            {/* Branch Documents section — collapsible */}
            {nomination.branchId && (
              <Stack gap={0}>
                <NominationSectionHeader
                  label="Branch Documents"
                  expanded={branchDocsOpen}
                  controls="nomination-branch-documents-content"
                  onToggle={() => setBranchDocsOpen((o) => !o)}
                />
                <Collapse id="nomination-branch-documents-content" in={branchDocsOpen}>
                  <Box pt="xs">
                    <BranchDocumentsPanel nomination={nomination} />
                  </Box>
                </Collapse>
              </Stack>
            )}

            <Divider />

            {/* Messages section — collapsible */}
            <Stack gap={0} id="messages-section">
              <NominationSectionHeader
                label="Messages"
                expanded={messagesOpen}
                controls="nomination-messages-content"
                onToggle={() => setMessagesOpen((o) => !o)}
              />
              <Collapse id="nomination-messages-content" in={messagesOpen}>
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
              <NominationSectionHeader
                label="Status History"
                expanded={historyOpen}
                controls="nomination-status-history-content"
                onToggle={() => setHistoryOpen((o) => !o)}
                compact
              />
              <Collapse id="nomination-status-history-content" in={historyOpen}>
                <Box pt="xs">
                  <StatusHistoryTimeline history={nomination.statusHistory} />
                </Box>
              </Collapse>
            </Stack>

            <Divider my="sm" />
            <Stack gap={0}>
              <NominationSectionHeader
                label="Actions"
                expanded={actionsOpen}
                controls="nomination-actions-content"
                onToggle={() => setActionsOpen((o) => !o)}
                compact
              />
              <Collapse id="nomination-actions-content" in={actionsOpen}>
                <Box pt="xs">
                  <NominationInstructionsAction
                    nominationId={nomination.id}
                    reference={nomination.administrativeSnOt ?? nomination.snOt}
                    nominationSavePending={updateNomination.isPending}
                    client={nomination.client ?? nomination.charterer}
                    disabled={isReadOnly}
                  />
                  {pedr && (
                    <EmailActionsPanel
                      nominationId={nomination.id}
                      opPortId={nomination.opPortId}
                      pedrId={pedr.id}
                      vesselName={nomination.shipParticular.name}
                      parcels={nomination.parcels as NominationParcel[]}
                    />
                  )}
                </Box>
              </Collapse>
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
}
