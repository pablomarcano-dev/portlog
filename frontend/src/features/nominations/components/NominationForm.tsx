import { useState } from 'react';
import { Button, Fieldset, Grid, Group, Radio, Stack, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { NominationCreateSchema } from '@portlog/schemas';
import type { NominationCreateInput } from '@portlog/schemas';
import { apiRequest } from '../../../lib/api/client';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import { FeaturesFieldArray } from './FeaturesFieldArray';
import { AisSuggestionPanel } from './AisSuggestionPanel';

interface NominationFormProps {
  mode: 'create' | 'edit';
  defaultValues?: Partial<NominationCreateInput>;
  onSubmit: (vals: NominationCreateInput) => void;
  isSubmitting: boolean;
  isReadOnly?: boolean;
}

export function NominationForm({
  mode,
  defaultValues,
  onSubmit,
  isSubmitting,
  isReadOnly = false,
}: NominationFormProps) {
  const navigate = useNavigate();

  const form = useForm<NominationCreateInput>({
    resolver: zodResolver(NominationCreateSchema),
    defaultValues: {
      voyageNumber: '',
      voyageCode: '',
      nominationType: 'FULL_AGENCY',
      features: [],
      ...defaultValues,
    },
  });

  const { register, handleSubmit, control, reset, formState, watch } = form;

  // Watch the selected vessel so we can fetch its IMO for AIS lookup
  const shipParticularId = watch('shipParticularId');

  const selectedShipQuery = useQuery({
    queryKey: ['ship-particulars', shipParticularId],
    queryFn: () =>
      apiRequest<{ imoNumber: string | null }>(`/master-data/ship-particulars/${shipParticularId}`),
    enabled: !!shipParticularId,
    staleTime: 60_000,
  });

  const imo = selectedShipQuery.data?.imoNumber ?? null;

  // Search state for each EntityPicker
  const [shipSearch, setShipSearch] = useState('');
  const [operatorSearch, setOperatorSearch] = useState('');
  const [charterSearch, setCharterSearch] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [shipperSearch, setShipperSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [opPortSearch, setOpPortSearch] = useState('');
  const [berthPortSearch, setBerthPortSearch] = useState('');
  const [lastPortSearch, setLastPortSearch] = useState('');
  const [nextPortSearch, setNextPortSearch] = useState('');
  const [disPortSearch, setDisPortSearch] = useState('');
  const [externalPortSearch, setExternalPortSearch] = useState('');

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        {/* 1. Voyage & Vessel */}
        <Fieldset legend="Voyage & Vessel">
          <Stack gap="sm">
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Voyage Number"
                  placeholder="e.g. VY-2024-001"
                  required
                  disabled={isReadOnly}
                  error={formState.errors.voyageNumber?.message}
                  {...register('voyageNumber')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Voyage Code"
                  placeholder="e.g. VC-001"
                  disabled={isReadOnly}
                  error={formState.errors.voyageCode?.message}
                  {...register('voyageCode')}
                />
              </Grid.Col>
            </Grid>
            <Controller
              name="shipParticularId"
              control={control}
              render={({ field, fieldState }) => (
                <EntityPicker
                  endpoint="/master-data/ship-particulars"
                  label="Vessel"
                  required
                  value={field.value ?? null}
                  onChange={(val) => field.onChange(val ?? '')}
                  searchValue={shipSearch}
                  onSearchChange={setShipSearch}
                  error={fieldState.error?.message}
                />
              )}
            />
          </Stack>
        </Fieldset>

        {/* 2. Parties */}
        <Fieldset legend="Parties">
          <Stack gap="sm">
            {/* Operator */}
            <Grid align="flex-end">
              <Grid.Col span={5}>
                <Controller
                  name="operatorId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <EntityPicker
                      endpoint="/master-data/operators"
                      label="Operator"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      searchValue={operatorSearch}
                      onSearchChange={setOperatorSearch}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Operator Variant"
                  placeholder="Variant"
                  disabled={isReadOnly}
                  error={formState.errors.operatorVariant?.message}
                  {...register('operatorVariant')}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <TextInput
                  label="Op. Contact ID"
                  placeholder="Contact cuid"
                  disabled={isReadOnly}
                  error={formState.errors.operatorContactId?.message}
                  {...register('operatorContactId')}
                />
              </Grid.Col>
            </Grid>

            {/* Charterer */}
            <Grid align="flex-end">
              <Grid.Col span={5}>
                <Controller
                  name="charterId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <EntityPicker
                      endpoint="/master-data/charterers"
                      label="Charterer"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      searchValue={charterSearch}
                      onSearchChange={setCharterSearch}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Charter Variant"
                  placeholder="Variant"
                  disabled={isReadOnly}
                  error={formState.errors.charterVariant?.message}
                  {...register('charterVariant')}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <TextInput
                  label="Ch. Contact ID"
                  placeholder="Contact cuid"
                  disabled={isReadOnly}
                  error={formState.errors.charterContactId?.message}
                  {...register('charterContactId')}
                />
              </Grid.Col>
            </Grid>

            {/* Owner */}
            <Grid align="flex-end">
              <Grid.Col span={5}>
                <Controller
                  name="ownerId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <EntityPicker
                      endpoint="/master-data/owners"
                      label="Owner"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      searchValue={ownerSearch}
                      onSearchChange={setOwnerSearch}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Owner Variant"
                  placeholder="Variant"
                  disabled={isReadOnly}
                  error={formState.errors.ownerVariant?.message}
                  {...register('ownerVariant')}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <TextInput
                  label="Ow. Contact ID"
                  placeholder="Contact cuid"
                  disabled={isReadOnly}
                  error={formState.errors.ownerContactId?.message}
                  {...register('ownerContactId')}
                />
              </Grid.Col>
            </Grid>

            {/* Shipper */}
            <Grid align="flex-end">
              <Grid.Col span={5}>
                <Controller
                  name="shipperId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <EntityPicker
                      endpoint="/master-data/shippers"
                      label="Shipper"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      searchValue={shipperSearch}
                      onSearchChange={setShipperSearch}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Shipper Variant"
                  placeholder="Variant"
                  disabled={isReadOnly}
                  error={formState.errors.shipperVariant?.message}
                  {...register('shipperVariant')}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <TextInput
                  label="Sh. Contact ID"
                  placeholder="Contact cuid"
                  disabled={isReadOnly}
                  error={formState.errors.shipperContactId?.message}
                  {...register('shipperContactId')}
                />
              </Grid.Col>
            </Grid>

            {/* Branch */}
            <Grid>
              <Grid.Col span={6}>
                <Controller
                  name="branchId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <EntityPicker
                      endpoint="/master-data/branches"
                      label="Branch (Sucursal)"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      searchValue={branchSearch}
                      onSearchChange={setBranchSearch}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Grid.Col>
            </Grid>

            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="BlackBerry Contact"
                  placeholder="BB PIN or email"
                  disabled={isReadOnly}
                  error={formState.errors.contactBlackBerry?.message}
                  {...register('contactBlackBerry')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Blind Copy"
                  placeholder="BCC recipients"
                  disabled={isReadOnly}
                  error={formState.errors.blindCopy?.message}
                  {...register('blindCopy')}
                />
              </Grid.Col>
            </Grid>
          </Stack>
        </Fieldset>

        {/* AIS suggestion panel — shown only when vessel has a valid IMO */}
        {imo && /^\d{7}$/.test(imo) && <AisSuggestionPanel imo={imo} form={form} />}

        {/* 3. Ports */}
        <Fieldset legend="Ports">
          <Stack gap="sm">
            <Grid>
              <Grid.Col span={6}>
                <Controller
                  name="opPortId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <EntityPicker
                      endpoint="/master-data/ports"
                      label="Op Port"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      searchValue={opPortSearch}
                      onSearchChange={setOpPortSearch}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Controller
                  name="berthPortId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <EntityPicker
                      endpoint="/master-data/ports"
                      label="Berth Port"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      searchValue={berthPortSearch}
                      onSearchChange={setBerthPortSearch}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Grid.Col>
            </Grid>
            <Grid>
              <Grid.Col span={4}>
                <Controller
                  name="lastPortId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <EntityPicker
                      endpoint="/master-data/ports"
                      label="Last Port"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      searchValue={lastPortSearch}
                      onSearchChange={setLastPortSearch}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Controller
                  name="nextPortId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <EntityPicker
                      endpoint="/master-data/ports"
                      label="Next Port"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      searchValue={nextPortSearch}
                      onSearchChange={setNextPortSearch}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Controller
                  name="disPortId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <EntityPicker
                      endpoint="/master-data/ports"
                      label="Dis Port"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      searchValue={disPortSearch}
                      onSearchChange={setDisPortSearch}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Grid.Col>
            </Grid>
            <Grid>
              <Grid.Col span={4}>
                <Controller
                  name="externalPortId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <EntityPicker
                      endpoint="/master-data/ports"
                      label="External Port"
                      value={field.value ?? null}
                      onChange={field.onChange}
                      searchValue={externalPortSearch}
                      onSearchChange={setExternalPortSearch}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Grid.Col>
            </Grid>
          </Stack>
        </Fieldset>

        {/* 4. Dates */}
        <Fieldset legend="Dates">
          <Grid>
            <Grid.Col span={6}>
              <Controller
                name="dateNominated"
                control={control}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    label="Date Nominated (UTC)"
                    required
                    disabled={isReadOnly}
                    value={field.value instanceof Date ? field.value : null}
                    onChange={(val) => field.onChange(val)}
                    error={fieldState.error?.message}
                    clearable
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Controller
                name="etaDate"
                control={control}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    label="ETA Date (UTC)"
                    disabled={isReadOnly}
                    value={field.value instanceof Date ? field.value : null}
                    onChange={(val) => field.onChange(val)}
                    error={fieldState.error?.message}
                    clearable
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Controller
                name="layDaysFirst"
                control={control}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    label="Lay Days First (UTC)"
                    disabled={isReadOnly}
                    value={field.value instanceof Date ? field.value : null}
                    onChange={(val) => field.onChange(val)}
                    error={fieldState.error?.message}
                    clearable
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Controller
                name="layDaysLast"
                control={control}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    label="Lay Days Last (UTC)"
                    disabled={isReadOnly}
                    value={field.value instanceof Date ? field.value : null}
                    onChange={(val) => field.onChange(val)}
                    error={fieldState.error?.message}
                    clearable
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Controller
                name="nomReply"
                control={control}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    label="Nom. Reply (UTC)"
                    disabled={isReadOnly}
                    value={field.value instanceof Date ? field.value : null}
                    onChange={(val) => field.onChange(val)}
                    error={fieldState.error?.message}
                    clearable
                  />
                )}
              />
            </Grid.Col>
          </Grid>
        </Fieldset>

        {/* 5. People */}
        <Fieldset legend="People">
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Nominated By (ID)"
                placeholder="User cuid"
                disabled={isReadOnly}
                error={formState.errors.nominatedById?.message}
                {...register('nominatedById')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Master"
                placeholder="Captain name"
                disabled={isReadOnly}
                error={formState.errors.master?.message}
                {...register('master')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="MIC"
                placeholder="MIC officer"
                disabled={isReadOnly}
                error={formState.errors.mic?.message}
                {...register('mic')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Broker"
                placeholder="Broker name"
                disabled={isReadOnly}
                error={formState.errors.broker?.message}
                {...register('broker')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Boarding Clerk"
                placeholder="Boarding clerk"
                disabled={isReadOnly}
                error={formState.errors.boardingClerk?.message}
                {...register('boardingClerk')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Inspector"
                placeholder="Inspector name"
                disabled={isReadOnly}
                error={formState.errors.inspector?.message}
                {...register('inspector')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Mobile on Board"
                placeholder="e.g. +1 555 0100"
                disabled={isReadOnly}
                error={formState.errors.mobileOnBoard?.message}
                {...register('mobileOnBoard')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Reference N°"
                placeholder="Reference number"
                disabled={isReadOnly}
                error={formState.errors.referenceNo?.message}
                {...register('referenceNo')}
              />
            </Grid.Col>
          </Grid>
        </Fieldset>

        {/* 6. Type & Subject */}
        <Fieldset legend="Type & Subject">
          <Stack gap="sm">
            <Controller
              name="nominationType"
              control={control}
              render={({ field }) => (
                <Radio.Group label="Nomination Type" value={field.value} onChange={field.onChange}>
                  <Group mt="xs">
                    <Radio value="FULL_AGENCY" label="Full Agency" disabled={isReadOnly} />
                    <Radio
                      value="OWNERS_AGENTS_ONLY"
                      label="Owner's Agents Only"
                      disabled={isReadOnly}
                    />
                    <Radio
                      value="CHARTERERS_AGENTS_ONLY"
                      label="Charterer's Agents Only"
                      disabled={isReadOnly}
                    />
                  </Group>
                </Radio.Group>
              )}
            />
            <Textarea
              label="Subject"
              placeholder="Email subject or notes"
              autosize
              minRows={2}
              disabled={isReadOnly}
              error={formState.errors.subject?.message}
              {...register('subject')}
            />
          </Stack>
        </Fieldset>

        {/* 7. Cargo Features */}
        <Fieldset legend="Cargo Features">
          <FeaturesFieldArray control={control} disabled={isReadOnly} />
        </Fieldset>

        {/* Action buttons */}
        {!isReadOnly && (
          <Group justify="flex-end" mt="md">
            {mode === 'create' ? (
              <>
                <Button variant="default" onClick={() => reset()} disabled={isSubmitting}>
                  Clear
                </Button>
                <Button
                  variant="default"
                  onClick={() =>
                    void navigate({ to: '/nominations', search: { page: 1, pageSize: 25 } })
                  }
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  Create
                </Button>
              </>
            ) : (
              <Button type="submit" loading={isSubmitting}>
                Save Changes
              </Button>
            )}
          </Group>
        )}
      </Stack>
    </form>
  );
}
