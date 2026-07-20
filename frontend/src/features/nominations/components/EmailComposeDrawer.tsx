import { useEffect } from 'react';
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  Textarea,
  TextInput,
  TagsInput,
  Alert,
  Loader,
  Box,
  Table,
  Divider,
  NumberInput,
} from '@mantine/core';
import { DateTimePicker, DatePickerInput } from '@mantine/dates';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePedrEvents } from '../api/usePedrEvents';
import type { SubDocType } from '@portlog/schemas';
import { useEmailDispatch } from '../api/useEmailDispatch';
import { useNominationCompose } from '../api/useNominationCompose';
import { useNominationSendEmail } from '../api/useNominationSendEmail';
import { EmailGroupPicker } from '../../../components/master-data/EmailGroupPicker';

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
}

const SUB_DOC_LABELS: Record<SubDocType, string> = {
  ACKNOWLEDGEMENT: 'Acknowledgement of Nomination',
  PREARRIVAL: 'Pre-Arrival Notification',
  ETA_ETB: 'ETA / ETB Notice',
  ETA_REQUEST: 'ETA Request to Master',
  ETA_TERMINAL: 'ETA — Send to Terminal',
  ETA_REPLY: 'Reply to Master (ETB/ETPOB)',
  NOR: 'Notice of Readiness',
  SOF: 'Statement of Facts',
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
  bodyHtml: z.string().default(''),
  etb: z.date().nullable().optional(),
  berthNumber: z.string().optional(),
  etcDate: z.date().nullable().optional(),
  norTenderedAt: z.date().nullable().optional(),
  norAcceptedAt: z.date().nullable().optional(),
  layTimeCommences: z.date().nullable().optional(),
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
}: EmailComposeDrawerProps) {
  const composeQuery = useNominationCompose(nominationId, subDocType, opened);
  const dispatch = useEmailDispatch(pedrId, nominationId);
  const nominationSend = useNominationSendEmail(nominationId);
  const isNominationLevel =
    subDocType === 'ACKNOWLEDGEMENT' ||
    subDocType === 'PREARRIVAL' ||
    subDocType === 'ETA_REQUEST' ||
    subDocType === 'ETA_TERMINAL' ||
    subDocType === 'ETA_REPLY';
  const pedrEventsQuery = usePedrEvents(subDocType === 'SOF' ? pedrId : '');

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
      subject: defaultSubject,
      bodyHtml: defaultBody,
      etb: null,
      berthNumber: '',
      etcDate: null,
      norTenderedAt: null,
      norAcceptedAt: null,
      layTimeCommences: null,
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
      setValue('subject', d.subject);
      setValue('bodyHtml', d.bodyHtml);
    }
  }, [opened, composeQuery.data, setValue]);

  const toAddresses = watch('toAddresses');
  const ccAddresses = watch('ccAddresses');
  const bccAddresses = watch('bccAddresses');
  const bodyHtml = watch('bodyHtml');
  const norTenderedAt = watch('norTenderedAt');
  const blQuantity = watch('blQuantity');
  const blDate = watch('blDate');

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(values: ComposeForm) {
    const extraData =
      subDocType === 'ETA_ETB'
        ? {
            etb: values.etb ? values.etb.toISOString() : undefined,
            berthNumber: values.berthNumber || undefined,
            etcDate: values.etcDate ? values.etcDate.toISOString() : undefined,
          }
        : subDocType === 'NOR'
          ? {
              norTenderedAt: values.norTenderedAt ? values.norTenderedAt.toISOString() : undefined,
              norAcceptedAt: values.norAcceptedAt ? values.norAcceptedAt.toISOString() : undefined,
              layTimeCommences: values.layTimeCommences
                ? values.layTimeCommences.toISOString()
                : undefined,
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
          bodyHtml: values.bodyHtml || '',
        },
        { onSuccess: () => handleClose() },
      );
    } else {
      dispatch.mutate(
        {
          subDocType,
          toAddresses: values.toAddresses,
          ccAddresses: values.ccAddresses,
          bccAddresses: values.bccAddresses,
          subject: values.subject,
          bodyHtml: values.bodyHtml || undefined,
          extraData,
        },
        { onSuccess: () => handleClose() },
      );
    }
  }

  const isLoading = composeQuery.isLoading && !!nominationId;

  return (
    <Modal
      opened={opened}
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
            {/* SOF event log preview */}
            {subDocType === 'SOF' && (
              <Box>
                <Text fw={600} size="sm" mb={4}>
                  Event Log
                </Text>
                {pedrEventsQuery.isLoading ? (
                  <Box ta="center" py="sm">
                    <Loader size="xs" />
                  </Box>
                ) : pedrEventsQuery.data?.length === 0 ? (
                  <Alert color="yellow" title="No events recorded yet">
                    The SOF will be empty.
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
                      {pedrEventsQuery.data?.map((ev) => (
                        <Table.Tr key={ev.id}>
                          <Table.Td>{new Date(ev.occurredAt).toLocaleString()}</Table.Td>
                          <Table.Td>{ev.kind.replace(/_/g, ' ')}</Table.Td>
                          <Table.Td>{ev.note ?? ''}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
                <Divider mt="sm" />
              </Box>
            )}

            {/* Recipients */}
            <TagsInput
              label="To"
              placeholder="Type an email and press Enter"
              value={toAddresses}
              onChange={(val) => setValue('toAddresses', val, { shouldValidate: true })}
              error={errors.toAddresses?.message}
            />
            <TagsInput
              label="CC"
              placeholder="Type an email and press Enter"
              value={ccAddresses}
              onChange={(val) => setValue('ccAddresses', val)}
            />
            <TagsInput
              label="BCC"
              placeholder="Type an email and press Enter"
              value={bccAddresses}
              onChange={(val) => setValue('bccAddresses', val)}
            />

            {/* Add from group */}
            <EmailGroupPicker
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
              value={bodyHtml}
              onChange={(e) => setValue('bodyHtml', e.currentTarget.value)}
              minRows={16}
              autosize
              styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
              placeholder="HTML email body…"
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
                      value={field.value ?? null}
                      onChange={field.onChange}
                      clearable
                      error={errors.etcDate?.message}
                    />
                  )}
                />
              </>
            )}

            {/* NOR extra fields */}
            {subDocType === 'NOR' && (
              <>
                <Divider label="NOR Details" labelPosition="left" />
                <Controller
                  name="norTenderedAt"
                  control={control}
                  render={({ field }) => (
                    <DateTimePicker
                      label="NOR Tendered At"
                      placeholder="Select date and time"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      required
                      error={errors.norTenderedAt?.message}
                    />
                  )}
                />
                <Controller
                  name="norAcceptedAt"
                  control={control}
                  render={({ field }) => (
                    <DateTimePicker
                      label="NOR Accepted At"
                      placeholder="Select date and time"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      clearable
                      error={errors.norAcceptedAt?.message}
                    />
                  )}
                />
                <Controller
                  name="layTimeCommences"
                  control={control}
                  render={({ field }) => (
                    <DateTimePicker
                      label="Lay Time Commences"
                      placeholder="Select date and time"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      clearable
                      error={errors.layTimeCommences?.message}
                    />
                  )}
                />
              </>
            )}

            {/* CARGO_UPDATE extra fields */}
            {subDocType === 'CARGO_UPDATE' && (
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

            {/* Actions */}
            <Group justify="flex-end" mt="sm">
              <Button
                variant="default"
                onClick={handleClose}
                disabled={(isNominationLevel ? nominationSend : dispatch).isPending}
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
                  (subDocType === 'NOR' && !norTenderedAt) ||
                  (subDocType === 'CARGO_UPDATE' && (blQuantity == null || !blDate))
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
