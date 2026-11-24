import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  getUpdateSubjectParts,
  operationalUpdateInstant,
  operationalUpdateModeSchema,
  suggestOperationalUpdateMode,
  type OperationalUpdateComposeQuery,
} from '@portlog/schemas';
import { zodResolver } from '../../../lib/zodResolver';
import { parseDateInput } from '../../../lib/format/datetime';
import { TimeInput24 } from '../../../components/inputs/TimeInput24';
import { useNominationSof } from '../hooks/useNominationSof';
import { EmailComposeDrawer } from './EmailComposeDrawer';

const schema = z
  .object({
    mode: operationalUpdateModeSchema
      .nullable()
      .refine((v): boolean => v !== null, 'Choose the update mode.'),
    date: z
      .date()
      .nullable()
      .refine((v): boolean => v !== null, 'Choose the update date.'),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time.'),
  })
  .superRefine((values, ctx) => {
    if (!values.date) return;
    try {
      operationalUpdateInstant(values.date, values.time);
    } catch {
      ctx.addIssue({
        code: 'custom',
        path: ['time'],
        message: 'Choose a valid Caracas local time.',
      });
    }
  });
type Form = z.infer<typeof schema>;
const modes = [
  { value: 'ANCHOR', label: 'At anchor — Update at Anchor' },
  { value: 'ALONGSIDE', label: 'Alongside, no operations — Update at Alongside' },
  { value: 'CARGO', label: 'Alongside, in operations — Cargo Update' },
];

export function OperationalUpdateModal({
  opened,
  onClose,
  onCargo,
  nominationId,
  pedrId,
}: {
  opened: boolean;
  onClose: () => void;
  onCargo: (defaults: { date: Date; time: string; automatic: boolean }) => void;
  nominationId: string;
  pedrId: string;
}) {
  const sof = useNominationSof(opened ? nominationId : '');
  const [options, setOptions] = useState<OperationalUpdateComposeQuery | null>(null);
  const initialized = useRef(false);
  const timestampEdited = useRef(false);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { mode: null, date: null, time: '' },
  });
  useEffect(() => {
    if (!opened) {
      initialized.current = false;
      return;
    }
    if (initialized.current) return;
    initialized.current = true;
    timestampEdited.current = false;
    const now = getUpdateSubjectParts(new Date(), false);
    reset({ mode: null, date: new Date(now.year, now.month - 1, now.day), time: now.time });
  }, [opened, reset]);
  useEffect(() => {
    if (!opened || !sof.data || getFieldState('mode').isDirty) return;
    const suggestion = suggestOperationalUpdateMode(
      sof.data.entries.map((event) => ({
        occurredAt: event.occurredAt,
        activityName: event.activity?.name ?? null,
      })),
    );
    setValue('mode', suggestion);
  }, [opened, sof.data, getFieldState, setValue]);

  function continueUpdate(values: Form) {
    if (!values.mode || !values.date) return;
    if (values.mode === 'CARGO') {
      onClose();
      onCargo({ date: values.date, time: values.time, automatic: !timestampEdited.current });
      return;
    }
    setOptions({
      mode: values.mode,
      at: operationalUpdateInstant(values.date, values.time).toISOString(),
      automatic: timestampEdited.current ? 'false' : 'true',
    });
  }
  return (
    <>
      <Modal opened={opened && !options} onClose={onClose} title="Operational update" size="md">
        <form onSubmit={handleSubmit(continueUpdate)}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Choose the vessel's current operation. A saved SOF event may suggest a mode; you can
              change it.
            </Text>
            {sof.isError && (
              <Alert color="yellow">
                Saved events could not be loaded. Select the current mode manually.
              </Alert>
            )}
            <Controller
              name="mode"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  label="Update mode"
                  placeholder="Select current operation"
                  data={modes}
                  error={errors.mode?.message}
                  required
                />
              )}
            />
            <Group grow align="flex-start">
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <DateInput
                    {...field}
                    onChange={(value) => {
                      timestampEdited.current = true;
                      field.onChange(value);
                    }}
                    label="Update date (Caracas)"
                    valueFormat="DD/MM/YYYY"
                    dateParser={parseDateInput}
                    error={errors.date?.message}
                    required
                  />
                )}
              />
              <Controller
                name="time"
                control={control}
                render={({ field }) => (
                  <TimeInput24
                    value={field.value}
                    onChange={(value) => {
                      timestampEdited.current = true;
                      field.onChange(value);
                    }}
                    label="Time"
                    error={errors.time?.message}
                    required
                  />
                )}
              />
            </Group>
            <Text size="xs" c="dimmed">
              Automatic subject time rounds to ten minutes. Editing the date or time keeps your
              exact value. Choosing a mode does not change SOF events.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={onClose}>
                Close
              </Button>
              <Button type="submit">Continue</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      {options && (
        <EmailComposeDrawer
          opened={opened}
          onClose={() => {
            setOptions(null);
            onClose();
          }}
          nominationId={nominationId}
          pedrId={pedrId}
          subDocType="OPERATIONAL_UPDATE"
          defaultSubject="Operational update"
          composeOptions={options}
        />
      )}
    </>
  );
}
