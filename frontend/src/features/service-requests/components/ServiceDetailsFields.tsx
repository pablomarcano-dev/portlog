import { Checkbox, Group, NumberInput, Select, Stack, TextInput } from '@mantine/core';
import { Controller, useFormContext } from 'react-hook-form';
import {
  BALLAST_ANALYSIS_TYPE_LABELS,
  LAUNCH_SERVICE_TYPE_LABELS,
  MAX_TUGS,
  STS_ROLE_LABELS,
  TUG_OPERATION_TYPE_LABELS,
  UNDERWATER_INSPECTION_TYPE_LABELS,
  UNDERWATER_METHOD_LABELS,
  toSelectOptions,
  type ServiceRequestType,
} from '@portlog/schemas';
import type { ServiceRequestFormValues } from '../formDefaults';

/**
 * Step 2 of the stepper — the only part of the form that differs per request
 * type. Mirrors `ServiceRequestDetailsSchema`: one branch per union member,
 * every field written under `details.*` so react-hook-form's resolver validates
 * against the discriminated union directly.
 *
 * `toSelectOptions` takes the English side of each bilingual label; the Spanish
 * side is reserved for the purchase-order PDF the provider receives.
 */

const LAUNCH_OPTIONS = toSelectOptions(LAUNCH_SERVICE_TYPE_LABELS);
const UNDERWATER_OPTIONS = toSelectOptions(UNDERWATER_INSPECTION_TYPE_LABELS);
const UNDERWATER_METHOD_OPTIONS = toSelectOptions(UNDERWATER_METHOD_LABELS);
const BALLAST_OPTIONS = toSelectOptions(BALLAST_ANALYSIS_TYPE_LABELS);
const TUG_OPTIONS = toSelectOptions(TUG_OPERATION_TYPE_LABELS);
const STS_ROLE_OPTIONS = toSelectOptions(STS_ROLE_LABELS);

interface Props {
  type: ServiceRequestType;
  disabled?: boolean;
}

export function ServiceDetailsFields({ type, disabled = false }: Props) {
  const { control, register, formState } = useFormContext<ServiceRequestFormValues>();

  // react-hook-form types `errors.details` as the union of every member's error
  // shape; reading a member-specific key needs a widening cast.
  const detailErrors = (formState.errors.details ?? {}) as Record<
    string,
    { message?: string } | undefined
  >;
  const errorFor = (key: string): string | undefined => detailErrors[key]?.message;

  switch (type) {
    case 'LAUNCH':
      return (
        <Stack gap="sm">
          <Controller
            name="details.serviceType"
            control={control}
            render={({ field, fieldState }) => (
              <Select
                label="Service Type"
                placeholder="Select the launch service"
                data={LAUNCH_OPTIONS}
                required
                searchable
                disabled={disabled}
                value={(field.value as string | undefined) ?? null}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Group grow align="flex-start">
            <Controller
              name="details.boatCount"
              control={control}
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Number of Boats"
                  min={1}
                  max={20}
                  required
                  disabled={disabled}
                  value={(field.value as number | undefined) ?? 1}
                  onChange={(val) => field.onChange(val === '' ? 1 : Number(val))}
                  error={fieldState.error?.message}
                />
              )}
            />
            <TextInput
              label="Departure Point"
              placeholder="e.g. Pilot jetty"
              disabled={disabled}
              error={errorFor('departurePoint')}
              {...register('details.departurePoint')}
            />
          </Group>
        </Stack>
      );

    case 'UNDERWATER_INSPECTION':
      return (
        <Stack gap="sm">
          <Controller
            name="details.inspectionType"
            control={control}
            render={({ field, fieldState }) => (
              <Select
                label="Inspection Type"
                placeholder="Select the inspection"
                data={UNDERWATER_OPTIONS}
                required
                searchable
                disabled={disabled}
                value={(field.value as string | undefined) ?? null}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="details.method"
            control={control}
            render={({ field, fieldState }) => (
              <Select
                label="Method Required"
                data={UNDERWATER_METHOD_OPTIONS}
                required
                disabled={disabled}
                value={(field.value as string | undefined) ?? 'COMMERCIAL_DIVERS'}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Checkbox.Group label="Deliverables">
            <Stack gap="xs" mt="xs">
              <Controller
                name="details.deliverables.liveCctv"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    label="Live CCTV video"
                    disabled={disabled}
                    checked={Boolean(field.value)}
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                name="details.deliverables.photos"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    label="Photos"
                    disabled={disabled}
                    checked={Boolean(field.value)}
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                name="details.deliverables.technicalReport"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    label="Technical report"
                    disabled={disabled}
                    checked={Boolean(field.value)}
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                )}
              />
            </Stack>
          </Checkbox.Group>
        </Stack>
      );

    case 'BALLAST_WATER':
      return (
        <Stack gap="sm">
          <Controller
            name="details.analysisType"
            control={control}
            render={({ field, fieldState }) => (
              <Select
                label="Service / Analysis Type"
                placeholder="Select the analysis"
                data={BALLAST_OPTIONS}
                required
                searchable
                disabled={disabled}
                value={(field.value as string | undefined) ?? null}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Group grow align="flex-start">
            <Controller
              name="details.tankCount"
              control={control}
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Tanks to Inspect"
                  min={1}
                  max={100}
                  required
                  disabled={disabled}
                  value={(field.value as number | undefined) ?? ''}
                  onChange={(val) => field.onChange(val === '' ? undefined : Number(val))}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="details.requiresCertifiedLab"
              control={control}
              render={({ field }) => (
                <Select
                  label="Certified Laboratory Required?"
                  data={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                  ]}
                  disabled={disabled}
                  value={field.value === true ? 'yes' : 'no'}
                  onChange={(val) => field.onChange(val === 'yes')}
                />
              )}
            />
          </Group>
          <Checkbox.Group label="Deliverables">
            <Stack gap="xs" mt="xs">
              <Controller
                name="details.deliverables.photos"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    label="Photos"
                    disabled={disabled}
                    checked={Boolean(field.value)}
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                name="details.deliverables.technicalReport"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    label="Technical report"
                    disabled={disabled}
                    checked={Boolean(field.value)}
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                )}
              />
            </Stack>
          </Checkbox.Group>
        </Stack>
      );

    case 'TUG':
      return (
        <Group grow align="flex-start">
          <Controller
            name="details.operationType"
            control={control}
            render={({ field, fieldState }) => (
              <Select
                label="Operation Type"
                placeholder="Select the manoeuvre"
                data={TUG_OPTIONS}
                required
                searchable
                disabled={disabled}
                value={(field.value as string | undefined) ?? null}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="details.tugCount"
            control={control}
            render={({ field, fieldState }) => (
              <NumberInput
                label="Number of Tugs"
                min={1}
                max={MAX_TUGS}
                required
                disabled={disabled}
                value={(field.value as number | undefined) ?? 1}
                onChange={(val) => field.onChange(val === '' ? 1 : Number(val))}
                error={fieldState.error?.message}
              />
            )}
          />
        </Group>
      );

    case 'STS':
      return (
        <Stack gap="sm">
          <Group grow align="flex-start">
            <TextInput
              label="Target Vessel"
              placeholder="Counterparty vessel name"
              required
              disabled={disabled}
              error={errorFor('targetVesselName')}
              {...register('details.targetVesselName')}
            />
            <Controller
              name="details.ourRole"
              control={control}
              render={({ field, fieldState }) => (
                <Select
                  label="Our Vessel’s Role"
                  data={STS_ROLE_OPTIONS}
                  required
                  disabled={disabled}
                  value={(field.value as string | undefined) ?? null}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          </Group>
          <Group grow align="flex-start">
            <TextInput
              label="Product"
              placeholder="e.g. Crude oil"
              required
              disabled={disabled}
              error={errorFor('product')}
              {...register('details.product')}
            />
            <Controller
              name="details.quantity"
              control={control}
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Quantity"
                  placeholder="500000"
                  min={0}
                  thousandSeparator=","
                  required
                  disabled={disabled}
                  value={(field.value as number | undefined) ?? ''}
                  onChange={(val) => field.onChange(val === '' ? undefined : Number(val))}
                  error={fieldState.error?.message}
                />
              )}
            />
            <TextInput
              label="Unit"
              placeholder="BBL"
              disabled={disabled}
              error={errorFor('quantityUnit')}
              {...register('details.quantityUnit')}
            />
          </Group>

          <Group align="flex-start" grow>
            <Checkbox.Group label="Equipment">
              <Stack gap="xs" mt="xs">
                <Controller
                  name="details.equipment.fenders"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      label="Fenders"
                      disabled={disabled}
                      checked={Boolean(field.value)}
                      onChange={(e) => field.onChange(e.currentTarget.checked)}
                    />
                  )}
                />
                <Controller
                  name="details.equipment.hoses"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      label="Hoses"
                      disabled={disabled}
                      checked={Boolean(field.value)}
                      onChange={(e) => field.onChange(e.currentTarget.checked)}
                    />
                  )}
                />
                <Controller
                  name="details.equipment.reducers"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      label="Reducers"
                      disabled={disabled}
                      checked={Boolean(field.value)}
                      onChange={(e) => field.onChange(e.currentTarget.checked)}
                    />
                  )}
                />
              </Stack>
            </Checkbox.Group>

            <Checkbox.Group label="Spill Prevention">
              <Stack gap="xs" mt="xs">
                <Controller
                  name="details.spillPrevention.floatingBarriers"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      label="Floating barrier deployment"
                      disabled={disabled}
                      checked={Boolean(field.value)}
                      onChange={(e) => field.onChange(e.currentTarget.checked)}
                    />
                  )}
                />
                <Controller
                  name="details.spillPrevention.watchBoat"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      label="Watch boat"
                      disabled={disabled}
                      checked={Boolean(field.value)}
                      onChange={(e) => field.onChange(e.currentTarget.checked)}
                    />
                  )}
                />
              </Stack>
            </Checkbox.Group>

            <Checkbox.Group label="Personnel">
              <Stack gap="xs" mt="xs">
                <Controller
                  name="details.personnel.mooringMaster"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      label="Mooring Master"
                      disabled={disabled}
                      checked={Boolean(field.value)}
                      onChange={(e) => field.onChange(e.currentTarget.checked)}
                    />
                  )}
                />
                <Controller
                  name="details.personnel.connectionTechnicians"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      label="Connection technicians"
                      disabled={disabled}
                      checked={Boolean(field.value)}
                      onChange={(e) => field.onChange(e.currentTarget.checked)}
                    />
                  )}
                />
              </Stack>
            </Checkbox.Group>
          </Group>
        </Stack>
      );

    case 'GENERAL':
      return (
        <TextInput
          label="Route Covered"
          placeholder="e.g. Guaraguao - Berth 3"
          disabled={disabled}
          error={errorFor('route')}
          {...register('details.route')}
        />
      );
  }
}
