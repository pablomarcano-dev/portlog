import { useEffect, useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  Textarea,
  TextInput,
  Alert,
  Loader,
  Box,
  Table,
  Divider,
  NumberInput,
  Checkbox,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { DateTimePicker, DatePickerInput } from '@mantine/dates';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNominationSof } from '../hooks/useNominationSof';
import type { EmailDispatchResponse, SubDocType } from '@portlog/schemas';
import { useEmailDispatch } from '../api/useEmailDispatch';
import { useNominationCompose } from '../api/useNominationCompose';
import { useNominationSendEmail } from '../api/useNominationSendEmail';
import { EmailGroupPicker } from '../../../components/master-data/EmailGroupPicker';
import { EmailChipsInput } from '../../../components/master-data/EmailChipsInput';
import { EmailAttachmentsField } from '../../../components/master-data/EmailAttachmentsField';
import { openEmailPrintWindow, printStoredEmailInWindow } from '../../../lib/printEmail';
import { formatDateTime } from '../../../lib/format/datetime';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailComposeDrawerProps {
  opened: boolean;
  onClose: () => void;
  pedrId: string;
  nominationId?: string;
  subDocType: SubDocType;
  defaultSubject: string;
  defaultBody?: string;
  /**
   * Subject that wins over the one the server composed.
   *
   * `defaultSubject` is only a placeholder for the moment before the draft
   * loads — the server-composed subject replaces it, since that is the one
   * carrying the nomination's reference line. This is the opposite: a subject
   * the caller has already reconciled with the body it is sending (the Cargo
   * Update stamp, the ETA countdown), which the composed one must not undo.
   */
  subjectOverride?: string;
}

const SUB_DOC_LABELS: Record<SubDocType, string> = {
  ACKNOWLEDGEMENT: 'Acknowledgement of Nomination',
  PREARRIVAL: 'Pre-Arrival Notification',
  ETA_ETB: 'ETA / ETB Notice',
  ETA_REQUEST: 'ETA Request to Master',
  ETA_TERMINAL: 'ETA — Send to Terminal',
  ETA_REPLY: 'Reply to Master (ETB/ETPOB)',
  ETA_RECAP: 'ETA’s Recaps & NOR',
  NOR: 'Notice of Readiness',
  SOF: 'Final Statement of Facts',
  SOF_INTERIM: 'Interim Statement of Facts',
  CARGO_UPDATE: 'Cargo Update',
};

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const composeSchema = z.object({
  toAddresses: z.array(z.string()).min(1, 'At least one recipient required'),
  ccAddresses: z.array(z.string()).default([]),
  bccAddresses: z.array(z.string()).default([]),
  subject: z.string().min(1, 'Subject is required'),
  // Plain text, start to finish. The backend wraps it for mail clients at send
  // time — nothing here composes HTML.
  bodyText: z.string().default(''),
  attachmentIds: z.array(z.string()).default([]),
  printAfterSending: z.boolean().default(false),
  etb: z.date().nullable().optional(),
  berthNumber: z.string().optional(),
  etcDate: z.date().nullable().optional(),
  blQuantity: z.number().nullable().optional(),
  blDate: z.date().nullable().optional(),
  vesselFigure: z.number().nullable().optional(),
  shoreFigure: z.number().nullable().optional(),
  cargoUpdateRemarks: z.string().optional(),
});
type ComposeForm = z.infer<typeof composeSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmailComposeDrawer({
  opened,
  onClose,
  pedrId,
  nominationId,
  subDocType,
  defaultSubject,
  defaultBody = '',
  subjectOverride = '',
}: EmailComposeDrawerProps) {
  const composeQuery = useNominationCompose(nominationId, subDocType, opened);
  const dispatch = useEmailDispatch(pedrId, nominationId);
  const nominationSend = useNominationSendEmail(nominationId);
  const isNominationLevel =
    subDocType === 'ACKNOWLEDGEMENT' ||
    subDocType === 'PREARRIVAL' ||
    subDocType === 'ETA_REQUEST' ||
    subDocType === 'ETA_TERMINAL' ||
    subDocType === 'ETA_REPLY' ||
    subDocType === 'ETA_RECAP' ||
    // The NOR forwarded to the terminal is a plain-text letter quoting the
    // master's notice, not a generated form — so it goes out on the
    // nomination-level route (no auto-generated PDF), like the others here.
    subDocType === 'NOR' ||
    subDocType === 'CARGO_UPDATE';
  const isSof = subDocType === 'SOF' || subDocType === 'SOF_INTERIM';
  const sofEventsQuery = useNominationSof(isSof ? (nominationId ?? '') : '');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<ComposeForm>({
    resolver: zodResolver(composeSchema),
    defaultValues: {
      toAddresses: [],
      ccAddresses: [],
      bccAddresses: [],
      subject: subjectOverride || defaultSubject,
      bodyText: defaultBody,
      attachmentIds: [],
      printAfterSending: false,
      etb: null,
      berthNumber: '',
      etcDate: null,
      blQuantity: null,
      blDate: null,
      vesselFigure: null,
      shoreFigure: null,
      cargoUpdateRemarks: '',
    },
  });

  // Pre-fill form when compose data loads or drawer reopens
  useEffect(() => {
    if (opened && composeQuery.data) {
      const d = composeQuery.data;
      setValue('toAddresses', d.toAddresses);
      setValue('ccAddresses', d.ccAddresses);
      setValue('bccAddresses', d.bccAddresses);
      // Prefer a caller-supplied subject and body (the Cargo Update modal
      // builds both from the date/time/ETD typed into it; the ETA dialog
      // re-titles the subject with the countdown the vessel has reached) over
      // the server-composed draft, which is stamped at compose time.
      setValue('subject', subjectOverride || d.subject);
      setValue('bodyText', defaultBody || d.bodyText);
    }
  }, [opened, composeQuery.data, defaultBody, subjectOverride, setValue]);

  const toAddresses = watch('toAddresses');
  const ccAddresses = watch('ccAddresses');
  const bccAddresses = watch('bccAddresses');
  const bodyText = watch('bodyText');
  const attachmentIds = watch('attachmentIds');
  const blQuantity = watch('blQuantity');
  const blDate = watch('blDate');

  // Bumped on close so EmailAttachmentsField remounts fresh (clears its internal
  // file list) — the form value resets, but the widget keeps local UI metadata.
  const [attachKey, setAttachKey] = useState(0);
  const [attachmentPreviewOpen, setAttachmentPreviewOpen] = useState(false);
  const [uploadsPending, setUploadsPending] = useState(false);

  function handleClose() {
    if (uploadsPending || (isNominationLevel ? nominationSend : dispatch).isPending) return;
    setAttachmentPreviewOpen(false);
    reset();
    setAttachKey((k) => k + 1);
    onClose();
  }

  async function onSubmit(values: ComposeForm) {
    if (uploadsPending || (isNominationLevel ? nominationSend : dispatch).isPending) return;
    const printWindow = values.printAfterSending ? openEmailPrintWindow() : null;
    if (values.printAfterSending && !printWindow) {
      notifications.show({
        color: 'yellow',
        title: 'Printing window blocked',
        message:
          'Allow pop-ups to print after sending. You can also print this message from Messages.',
      });
    }
    const afterSend = {
      onSuccess: (receipt: EmailDispatchResponse | null) => {
        if (values.printAfterSending) {
          if (receipt?.sentAt) {
            printStoredEmailInWindow(printWindow, {
              ...receipt,
              sentAt: receipt.sentAt,
              type: receipt.subDocType,
            });
          } else {
            printWindow?.close();
            notifications.show({
              color: 'yellow',
              title: 'Email sent; receipt unavailable',
              message:
                'Open the sent message in Messages to print its recorded contents. Do not resend it.',
            });
          }
        }
        handleClose();
      },
      onError: () => printWindow?.close(),
    };
    const extraData =
      subDocType === 'ETA_ETB'
        ? {
            etb: values.etb ? values.etb.toISOString() : undefined,
            berthNumber: values.berthNumber || undefined,
            etcDate: values.etcDate ? values.etcDate.toISOString() : undefined,
          }
        : subDocType === 'CARGO_UPDATE'
          ? {
              blQuantity: values.blQuantity ?? undefined,
              blDate: values.blDate ? values.blDate.toISOString().split('T')[0] : undefined,
              vesselFigure: values.vesselFigure ?? undefined,
              shoreFigure: values.shoreFigure ?? undefined,
              remarks: values.cargoUpdateRemarks || undefined,
            }
          : undefined;

    if (isNominationLevel) {
      nominationSend.mutate(
        {
          subDocType,
          toAddresses: values.toAddresses,
          ccAddresses: values.ccAddresses,
          bccAddresses: values.bccAddresses,
          subject: values.subject,
          bodyText: values.bodyText,
          attachmentIds: values.attachmentIds,
        },
        afterSend,
      );
    } else {
      dispatch.mutate(
        {
          subDocType,
          toAddresses: values.toAddresses,
          ccAddresses: values.ccAddresses,
          bccAddresses: values.bccAddresses,
          subject: values.subject,
          bodyText: values.bodyText || undefined,
          extraData,
          attachmentIds: values.attachmentIds,
        },
        afterSend,
      );
    }
  }

  const isLoading = composeQuery.isLoading && !!nominationId;

  return (
    <Modal
      opened={opened}
      closeOnEscape={
        !attachmentPreviewOpen &&
        !uploadsPending &&
        !(isNominationLevel ? nominationSend : dispatch).isPending
      }
      closeOnClickOutside={
        !attachmentPreviewOpen &&
        !uploadsPending &&
        !(isNominationLevel ? nominationSend : dispatch).isPending
      }
      trapFocus={!attachmentPreviewOpen}
      onClose={handleClose}
      title={
        <Text fw={600} size="sm">
          {SUB_DOC_LABELS[subDocType]}
        </Text>
      }
      size="xl"
      padding="lg"
    >
      {isLoading ? (
        <Box ta="center" py="xl">
          <Loader size="sm" />
        </Box>
      ) : (
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
          <Stack gap="sm">
            {subDocType === 'ETA_RECAP' && (
              <Alert color="blue" title="ETA recaps and NOR attachments">
                Attach the ETA recap and NOR documents referenced in this message, then review the
                attachments before sending.
              </Alert>
            )}
            {/* SOF event log preview */}
            {isSof && (
              <Box>
                <Text fw={600} size="sm" mb={4}>
                  Event Log
                </Text>
                {sofEventsQuery.isLoading ? (
                  <Box ta="center" py="sm">
                    <Loader size="xs" />
                  </Box>
                ) : sofEventsQuery.isError ? (
                  <Alert color="red" title="Could not load saved SOF events">
                    Close this message and retry. Your saved entries have not been changed.
                  </Alert>
                ) : sofEventsQuery.data?.entries.length === 0 ? (
                  <Alert color="yellow" title="No events recorded yet">
                    The saved SOF has no activity entries. Return to the timesheet to add and save
                    them.
                  </Alert>
                ) : (
                  <Table withTableBorder withColumnBorders fz="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Time</Table.Th>
                        <Table.Th>Event Type</Table.Th>
                        <Table.Th>Notes</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {sofEventsQuery.data?.entries.map((ev) => (
                        <Table.Tr key={ev.id}>
                          <Table.Td>{formatDateTime(ev.occurredAt)}</Table.Td>
                          <Table.Td>{ev.activity?.name ?? ''}</Table.Td>
                          <Table.Td>{ev.comment ?? ''}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
                <Divider mt="sm" />
              </Box>
            )}

            {/* Compose fetch failure — otherwise the drawer just opens blank and
                the missing subject / recipients look like a data problem. */}
            {composeQuery.isError && (
              <Alert color="orange" title="Could not load the draft">
                {composeQuery.error instanceof Error
                  ? composeQuery.error.message
                  : 'The template for this message could not be rendered.'}{' '}
                Recipients, subject and body have to be filled in by hand.
              </Alert>
            )}

            {/* Recipients — chips, so a whole distribution list can be pasted in
                one go (comma / semicolon / newline separated). To is sized for
                two groups' worth of addresses. */}
            <EmailChipsInput
              label="To"
              placeholder="Type or paste addresses…"
              value={toAddresses}
              onChange={(val) => setValue('toAddresses', val, { shouldValidate: true })}
              error={errors.toAddresses?.message}
              minHeight={96}
            />
            <EmailChipsInput
              label="CC"
              placeholder="Type or paste addresses…"
              value={ccAddresses}
              onChange={(val) => setValue('ccAddresses', val)}
              minHeight={64}
            />
            <EmailChipsInput
              label="BCC"
              placeholder="Type or paste addresses…"
              value={bccAddresses}
              onChange={(val) => setValue('bccAddresses', val)}
              minHeight={64}
            />

            {/* Add from group */}
            <EmailGroupPicker
              nominationOnly
              nominationId={nominationId}
              targets={[
                {
                  key: 'to',
                  label: 'To',
                  value: toAddresses,
                  onChange: (v) => setValue('toAddresses', v, { shouldValidate: true }),
                },
                {
                  key: 'cc',
                  label: 'CC',
                  value: ccAddresses,
                  onChange: (v) => setValue('ccAddresses', v),
                },
                {
                  key: 'bcc',
                  label: 'BCC',
                  value: bccAddresses,
                  onChange: (v) => setValue('bccAddresses', v),
                },
              ]}
            />

            {/* Subject */}
            <TextInput
              label="Subject"
              required
              {...register('subject')}
              error={errors.subject?.message}
            />

            {/* Body */}
            <Textarea
              label="Body"
              value={bodyText}
              onChange={(e) => setValue('bodyText', e.currentTarget.value)}
              minRows={16}
              autosize
              styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
              placeholder="Email body…"
            />

            {/* Attachments */}
            <EmailAttachmentsField
              key={attachKey}
              value={attachmentIds}
              onPreviewOpenChange={setAttachmentPreviewOpen}
              onPendingChange={setUploadsPending}
              onChange={(ids) => setValue('attachmentIds', ids)}
              disabled={(isNominationLevel ? nominationSend : dispatch).isPending}
            />

            {/* ETA/ETB extra fields */}
            {subDocType === 'ETA_ETB' && (
              <>
                <Divider label="ETA / ETB Details" labelPosition="left" />
                <Controller
                  name="etb"
                  control={control}
                  render={({ field }) => (
                    <DateTimePicker
                      label="ETB (Estimated Time of Berthing)"
                      placeholder="Select date and time"
                      valueFormat="DD/MM/YYYY HH:mm"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      clearable
                      error={errors.etb?.message}
                    />
                  )}
                />
                <TextInput
                  label="Berth No."
                  placeholder="e.g. B-12"
                  {...register('berthNumber')}
                  error={errors.berthNumber?.message}
                />
                <Controller
                  name="etcDate"
                  control={control}
                  render={({ field }) => (
                    <DateTimePicker
                      label="ETC (Estimated Time of Completion)"
                      placeholder="Select date and time"
                      valueFormat="DD/MM/YYYY HH:mm"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      clearable
                      error={errors.etcDate?.message}
                    />
                  )}
                />
              </>
            )}

            {/* CARGO_UPDATE extra fields — BL reconciliation figures apply only
                to the dispatch-based flow; the nomination-level cargo update
                carries its figures in the body built by the Cargo Update modal. */}
            {subDocType === 'CARGO_UPDATE' && !isNominationLevel && (
              <>
                <Divider label="Cargo Update Details" labelPosition="left" />
                <Controller
                  name="blQuantity"
                  control={control}
                  render={({ field }) => (
                    <NumberInput
                      label="BL Quantity (MT)"
                      placeholder="e.g. 25000"
                      value={field.value ?? ''}
                      onChange={(val) => field.onChange(val === '' ? null : val)}
                      required
                      min={0}
                      error={errors.blQuantity?.message}
                    />
                  )}
                />
                <Controller
                  name="blDate"
                  control={control}
                  render={({ field }) => (
                    <DatePickerInput
                      label="BL Date"
                      placeholder="Select date"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      required
                      clearable
                      error={errors.blDate?.message}
                    />
                  )}
                />
                <Controller
                  name="vesselFigure"
                  control={control}
                  render={({ field }) => (
                    <NumberInput
                      label="Vessel Figure (MT)"
                      placeholder="e.g. 24950"
                      value={field.value ?? ''}
                      onChange={(val) => field.onChange(val === '' ? null : val)}
                      min={0}
                      error={errors.vesselFigure?.message}
                    />
                  )}
                />
                <Controller
                  name="shoreFigure"
                  control={control}
                  render={({ field }) => (
                    <NumberInput
                      label="Shore Figure (MT)"
                      placeholder="e.g. 24980"
                      value={field.value ?? ''}
                      onChange={(val) => field.onChange(val === '' ? null : val)}
                      min={0}
                      error={errors.shoreFigure?.message}
                    />
                  )}
                />
                <Textarea
                  label="Remarks"
                  placeholder="Enter any remarks…"
                  minRows={2}
                  autosize
                  {...register('cargoUpdateRemarks')}
                  error={errors.cargoUpdateRemarks?.message}
                />
              </>
            )}

            {/* Send error */}
            {(isNominationLevel ? nominationSend.isError : dispatch.isError) && (
              <Alert color="red" title="Send failed">
                {(() => {
                  const err = isNominationLevel ? nominationSend.error : dispatch.error;
                  return err instanceof Error ? err.message : 'An unexpected error occurred.';
                })()}
              </Alert>
            )}

            <Controller
              name="printAfterSending"
              control={control}
              render={({ field }) => (
                <Checkbox
                  label="Print after sending"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />

            {/* Actions */}
            <Group justify="flex-end" mt="sm">
              <Button
                variant="default"
                onClick={handleClose}
                disabled={
                  (isNominationLevel ? nominationSend : dispatch).isPending || uploadsPending
                }
              >
                Close
              </Button>
              <Button variant="default" disabled>
                Save as Draft
              </Button>
              <Button
                type="submit"
                loading={(isNominationLevel ? nominationSend : dispatch).isPending}
                disabled={
                  uploadsPending ||
                  (subDocType === 'CARGO_UPDATE' &&
                    !isNominationLevel &&
                    (blQuantity == null || !blDate))
                }
              >
                Send
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
