import { createFileRoute } from '@tanstack/react-router';
import {
  Alert,
  Badge,
  Box,
  Container,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { NominationForm } from '../../../features/nominations/components/NominationForm';
import { TransitionButtons } from '../../../features/nominations/components/TransitionButtons';
import { StatusHistoryTimeline } from '../../../features/nominations/components/StatusHistoryTimeline';
import { MessagesNav } from '../../../features/nominations/components/MessagesNav';
import { ActionsPanel } from '../../../features/nominations/components/ActionsPanel';
import { EmailActionsPanel } from '../../../features/nominations/components/EmailActionsPanel';
import { ClientsSection } from '../../../features/nominations/components/ClientsSection';
import { useNomination } from '../../../features/nominations/hooks/useNomination';
import { useUpdateNomination } from '../../../features/nominations/hooks/useUpdateNomination';
import { usePedrByNomination } from '../../../features/nominations/api/usePedrByNomination';
import { DocumentsTabs } from '../../../features/sh-documents';
import { AllSentGrid } from '../../../features/all-sent/components/AllSentGrid';
import { useAllSent } from '../../../features/all-sent/api';
import type {
  NominationCreateInput,
  NominationStatus,
  NominationFeature,
  SubDocType,
} from '@portlog/schemas';

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

const SLUG_TO_SUBDOC: Record<string, SubDocType> = {
  acknowledgement: 'ACKNOWLEDGEMENT',
  prearrival: 'PREARRIVAL',
  eta: 'ETA_ETB',
  sof: 'SOF',
  'cargo-update': 'CARGO_UPDATE',
  nor: 'NOR',
};

function NominationDetailPage() {
  const { id } = Route.useParams();
  const { data: nomination, isLoading, isError, error } = useNomination(id);
  const updateNomination = useUpdateNomination(id);
  const { data: pedr } = usePedrByNomination(id);
  const [pendingDrawer, setPendingDrawer] = useState<SubDocType | null>(null);
  const { data: allSentData } = useAllSent({ nominationId: id });

  function handleMessagesNavAction(slug: string) {
    if (slug === 'all-sent') {
      document.getElementById('all-sent-section')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const subDocType = SLUG_TO_SUBDOC[slug];
    if (subDocType) setPendingDrawer(subDocType);
  }

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
    features: (nomination.features ?? []).filter(
      (f): f is NominationFeature =>
        typeof f.quantity === 'number' && typeof f.operation === 'string',
    ),
  };

  const handleUpdate = (vals: NominationCreateInput) => {
    updateNomination.mutate(vals);
  };

  return (
    <Box style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Left rail: Messages nav */}
      <Box
        style={{
          borderRight: '1px solid var(--mantine-color-gray-3)',
          flexShrink: 0,
          overflowY: 'auto',
        }}
      >
        <MessagesNav onAction={handleMessagesNavAction} />
      </Box>

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
              <TransitionButtons nominationId={nomination.id} currentStatus={nomination.status} />
            </Group>

            <Divider />

            {updateNomination.isError && (
              <Alert color="red" title="Error saving nomination">
                {updateNomination.error instanceof Error
                  ? updateNomination.error.message
                  : 'An unexpected error occurred.'}
              </Alert>
            )}

            <NominationForm
              mode="edit"
              defaultValues={defaultValues}
              onSubmit={handleUpdate}
              isSubmitting={updateNomination.isPending}
              isReadOnly={isReadOnly}
              correlative={nomination.correlative}
            />

            <Divider />

            {/* Client list section */}
            <ClientsSection nominationId={id} />

            <Divider />

            {/* Documents section — SH-xx forms */}
            <Stack gap="xs" id="sh-documents">
              <Title order={5}>Documentos</Title>
              <DocumentsTabs nominationId={id} />
            </Stack>

            <Divider />

            {/* All Sent tracker — scoped to this nomination */}
            <Stack gap="xs" id="all-sent-section">
              <Title order={5}>All Sent</Title>
              <AllSentGrid rows={allSentData?.rows ?? []} />
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Right rail: Nomination hub actions + Status history + Email actions */}
      <Box
        style={{
          width: 280,
          borderLeft: '1px solid var(--mantine-color-gray-3)',
          flexShrink: 0,
          overflowY: 'auto',
          padding: 'var(--mantine-spacing-md)',
        }}
      >
        {/* Nomination hub actions — always visible */}
        <ActionsPanel nominationId={id} vesselName={nomination.shipParticular.name} />

        <Divider my="md" />

        <Text fw={700} size="sm" mb="sm">
          Status History
        </Text>
        <StatusHistoryTimeline history={nomination.statusHistory} />

        {/* Email dispatch actions — shown only when a PEDR exists */}
        {pedr && (
          <Box mt="lg">
            <EmailActionsPanel
              pedrId={pedr.id}
              vesselName={nomination.shipParticular.name}
              externalOpen={pendingDrawer}
              onExternalOpenHandled={() => setPendingDrawer(null)}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
