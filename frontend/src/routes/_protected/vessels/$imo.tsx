import { lazy, Suspense, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Group,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDatalastic } from '../../../features/vessels/api/useDatalastic';
import { contactsApi } from '../../../lib/api/master-data/contacts';
import type { ContactCreateInput } from '@portlog/schemas';
import type {
  VesselInfo,
  VesselOwnership,
  VesselProData,
  VesselHistory,
  VesselInspection,
  VesselDryDock,
  VesselEngine,
} from '@portlog/schemas';

const VesselHistoryMap = lazy(() =>
  import('../../../features/vessels/components/VesselHistoryMap').then((m) => ({
    default: m.VesselHistoryMap,
  })),
);

export const Route = createFileRoute('/_protected/vessels/$imo')({
  component: VesselDetailPage,
});

interface Envelope<T> {
  data: T;
  meta?: { success: boolean };
}

// ---------------------------------------------------------------------------
// Save-to-contacts button
// ---------------------------------------------------------------------------

function SaveContactButton({ contact, label }: { contact: ContactCreateInput; label: string }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await contactsApi.create(contact);
      setSaved(true);
      notifications.show({ color: 'green', message: `"${contact.name}" saved to Contacts.` });
    } catch {
      notifications.show({
        color: 'red',
        message: `Failed to save "${contact.name}" to Contacts.`,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Tooltip label={saved ? 'Already saved' : `Save ${label} to Contacts`} withArrow>
      <Button
        size="xs"
        variant={saved ? 'light' : 'outline'}
        color={saved ? 'green' : 'blue'}
        disabled={saved || saving}
        loading={saving}
        onClick={() => void handleSave()}
      >
        {saved ? '✓ Saved' : 'Save to Contacts'}
      </Button>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500}>
        {value != null && value !== '' ? String(value) : '—'}
      </Text>
    </div>
  );
}

function LinkRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      {value ? (
        <Anchor size="sm" href={value} target="_blank" rel="noopener noreferrer">
          {value}
        </Anchor>
      ) : (
        <Text size="sm" fw={500}>
          —
        </Text>
      )}
    </div>
  );
}

function SectionCard({
  title,
  loading,
  skeletonCount = 8,
  children,
}: {
  title: string;
  loading: boolean;
  skeletonCount?: number;
  children: React.ReactNode;
}) {
  return (
    <Card withBorder>
      <Title order={4} mb="md">
        {title}
      </Title>
      {loading ? (
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <Skeleton key={i} height={40} />
          ))}
        </SimpleGrid>
      ) : (
        children
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function VesselDetailPage() {
  const { imo } = Route.useParams();
  const navigate = useNavigate();
  const enabled = /^\d{7}$/.test(imo);

  const {
    data: infoRes,
    isLoading: infoLoading,
    isError: infoError,
  } = useDatalastic<Envelope<VesselInfo>>('vessel_info', { imo }, { enabled });

  const { data: ownershipRes, isLoading: ownershipLoading } = useDatalastic<
    Envelope<VesselOwnership[]>
  >('ownership', { imo }, { enabled });

  const { data: proRes, isLoading: proLoading } = useDatalastic<Envelope<VesselProData>>(
    'vessel_pro',
    { imo },
    { enabled },
  );

  const { data: historyRes, isLoading: historyLoading } = useDatalastic<Envelope<VesselHistory>>(
    'vessel_history',
    { imo, days: '30' },
    { enabled },
  );

  const { data: engineRes, isLoading: engineLoading } = useDatalastic<Envelope<VesselEngine[]>>(
    'engine',
    { imo },
    { enabled },
  );

  const { data: dryDockRes, isLoading: dryDockLoading } = useDatalastic<Envelope<VesselDryDock[]>>(
    'dry_dock_dates',
    { imo },
    { enabled },
  );

  const { data: inspectionsRes, isLoading: inspectionsLoading } = useDatalastic<
    Envelope<VesselInspection[]>
  >('inspections', { imo }, { enabled });

  const info = infoRes?.data;
  const ownership = ownershipRes?.data?.[0];
  const pro = proRes?.data;
  const history = historyRes?.data;
  const engine = engineRes?.data?.[0];
  const dryDock = dryDockRes?.data?.[0];
  const inspections = inspectionsRes?.data ?? [];

  const vesselLabel = info?.name ?? `IMO ${imo}`;

  const sortedInspections = [...inspections].sort(
    (a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime(),
  );

  const sortedPositions = history?.positions
    ? [...history.positions]
        .sort((a, b) => b.last_position_epoch - a.last_position_epoch)
        .slice(0, 100)
    : [];

  // Build a SaveContactButton payload for a dry-dock technical manager
  function dryDockTechManagerContact(dd: VesselDryDock): ContactCreateInput {
    const commentParts = [
      dd.website ? `Website: ${dd.website}` : null,
      dd.linkedin ? `LinkedIn: ${dd.linkedin}` : null,
      dd.country_code ? `Country: ${dd.country_code}` : null,
      `Technical manager for vessel ${vesselLabel} (IMO ${imo})`,
    ].filter(Boolean);
    return {
      name: dd.technical_manager!,
      email: dd.email ?? undefined,
      businessPhone: dd.phone ?? undefined,
      address: dd.address ?? undefined,
      comments: commentParts.join('\n') || undefined,
    };
  }

  // Build a SaveContactButton payload for an ownership entity
  function ownershipContact(
    name: string,
    role: string,
    country?: string | null,
  ): ContactCreateInput {
    const commentParts = [
      `Role: ${role}`,
      country ? `Country: ${country}` : null,
      `For vessel: ${vesselLabel} (IMO ${imo})`,
    ].filter(Boolean);
    return { name, comments: commentParts.join('\n') };
  }

  return (
    <Container size="lg" py="lg">
      <Stack gap="lg">
        <Group>
          <Anchor
            size="sm"
            onClick={() => void navigate({ to: '/vessels' })}
            style={{ cursor: 'pointer' }}
          >
            ← Back to Vessels
          </Anchor>
        </Group>

        {/* Header */}
        <div>
          {infoLoading ? (
            <Skeleton height={32} width={300} mb={4} />
          ) : (
            <Title order={2}>{info?.name ?? `IMO ${imo}`}</Title>
          )}
          {!infoLoading && info && (
            <Text c="dimmed" size="sm">
              {info.type_specific || info.type} · {info.country_name ?? info.country_iso} · IMO{' '}
              {imo}
            </Text>
          )}
        </div>

        {infoError && (
          <Alert color="red" title="Error loading vessel">
            Could not load vessel information for IMO {imo}.
          </Alert>
        )}

        {/* Route Map */}
        <Card withBorder>
          <Title order={4} mb="md">
            Mapa de Recorrido (últimos 30 días)
          </Title>
          {historyLoading ? (
            <Skeleton height={420} />
          ) : history && history.positions.length > 0 ? (
            <>
              <Suspense fallback={<Skeleton height={420} />}>
                <VesselHistoryMap positions={history.positions} vesselName={info?.name} />
              </Suspense>
              <Group gap="md" mt="xs">
                <Group gap={6}>
                  <div
                    style={{ width: 12, height: 12, borderRadius: '50%', background: '#2f9e44' }}
                  />
                  <Text size="xs" c="dimmed">
                    Última posición
                  </Text>
                </Group>
                <Group gap={6}>
                  <div
                    style={{ width: 12, height: 12, borderRadius: '50%', background: '#fd7e14' }}
                  />
                  <Text size="xs" c="dimmed">
                    Paradas detectadas
                  </Text>
                </Group>
                <Group gap={6}>
                  <div style={{ width: 16, height: 3, background: '#228be6', borderRadius: 2 }} />
                  <Text size="xs" c="dimmed">
                    Recorrido
                  </Text>
                </Group>
              </Group>
            </>
          ) : (
            <Text size="sm" c="dimmed">
              Sin historial de posiciones disponible
            </Text>
          )}
        </Card>

        {/* Specifications */}
        <SectionCard title="Especificaciones" loading={infoLoading} skeletonCount={18}>
          {info ? (
            <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }}>
              <InfoRow label="Nombre" value={info.name} />
              <InfoRow label="Nombre AIS" value={info.name_ais} />
              <InfoRow label="IMO" value={info.imo} />
              <InfoRow label="MMSI" value={info.mmsi} />
              <InfoRow label="Callsign" value={info.callsign} />
              <InfoRow label="Bandera" value={info.country_name ?? info.country_iso} />
              <InfoRow label="Tipo" value={info.type_specific || info.type} />
              <InfoRow label="Año de Construcción" value={info.year_built} />
              <InfoRow label="Eslora (m)" value={info.length} />
              <InfoRow label="Manga (m)" value={info.breadth} />
              <InfoRow label="Calado Prom. (m)" value={info.draught_avg} />
              <InfoRow label="Calado Máx. (m)" value={info.draught_max} />
              <InfoRow label="Arqueo Bruto (GT)" value={info.gross_tonnage?.toLocaleString()} />
              <InfoRow label="Peso Muerto (DWT)" value={info.deadweight?.toLocaleString()} />
              <InfoRow label="TEU" value={info.teu} />
              <InfoRow label="Vel. Promedio (kn)" value={info.speed_avg} />
              <InfoRow label="Vel. Máxima (kn)" value={info.speed_max} />
              <InfoRow label="Puerto Base" value={info.home_port} />
            </SimpleGrid>
          ) : (
            <Text size="sm" c="dimmed">
              Sin datos de especificaciones
            </Text>
          )}
        </SectionCard>

        {/* Current Position */}
        <SectionCard title="Posición Actual" loading={proLoading} skeletonCount={9}>
          {pro ? (
            <SimpleGrid cols={{ base: 2, sm: 3 }}>
              <InfoRow
                label="Posición"
                value={
                  pro.lat && pro.lon ? `${pro.lat.toFixed(4)}, ${pro.lon.toFixed(4)}` : undefined
                }
              />
              <InfoRow label="Velocidad (kn)" value={pro.speed} />
              <InfoRow label="Rumbo" value={pro.heading != null ? `${pro.heading}°` : undefined} />
              <InfoRow label="Estado Nav." value={pro.navigation_status} />
              <InfoRow label="Destino" value={pro.destination} />
              <InfoRow label="ETA" value={pro.eta_UTC} />
              <InfoRow label="Puerto Destino" value={pro.dest_port} />
              <InfoRow label="UNLOCODE Destino" value={pro.dest_port_unlocode} />
              <InfoRow
                label="Última Actualización"
                value={
                  pro.last_position_epoch
                    ? new Date(pro.last_position_epoch * 1_000).toLocaleString()
                    : undefined
                }
              />
            </SimpleGrid>
          ) : (
            <Text size="sm" c="dimmed">
              Sin datos de posición en tiempo real
            </Text>
          )}
        </SectionCard>

        {/* Engine */}
        <SectionCard title="Motor" loading={engineLoading} skeletonCount={8}>
          {engine ? (
            <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }}>
              <InfoRow label="Designación" value={engine.engine_designation} />
              <InfoRow label="Diseñador" value={engine.engine_designer} />
              <InfoRow label="Constructor" value={engine.engine_builder} />
              <InfoRow
                label="MCO"
                value={
                  engine.mco != null
                    ? `${engine.mco.toLocaleString()} ${engine.mco_unit ?? 'kW'}`
                    : null
                }
              />
              <InfoRow label="RPM" value={engine.mco_rpm} />
              <InfoRow label="Tipo de Propulsión" value={engine.propulsion_type_code} />
              <InfoRow label="Arqueo Bruto (GT)" value={engine.gt?.toLocaleString()} />
              <InfoRow label="Año de Construcción" value={engine.built_year} />
            </SimpleGrid>
          ) : (
            <Text size="sm" c="dimmed">
              Sin datos de motor
            </Text>
          )}
        </SectionCard>

        {/* Dry Dock & Surveys */}
        <Card withBorder>
          <Group justify="space-between" align="flex-start" mb="md">
            <Title order={4}>Dique Seco y Certificaciones</Title>
            {!dryDockLoading && dryDock?.technical_manager && (
              <SaveContactButton
                label="Technical Manager"
                contact={dryDockTechManagerContact(dryDock)}
              />
            )}
          </Group>
          {dryDockLoading ? (
            <SimpleGrid cols={{ base: 2, sm: 3 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} height={40} />
              ))}
            </SimpleGrid>
          ) : dryDock ? (
            <SimpleGrid cols={{ base: 2, sm: 3 }}>
              <InfoRow label="Próximo Dique Seco" value={dryDock.dry_dock_date} />
              <InfoRow label="Próximo Rec. Especial" value={dryDock.special_survey_date} />
              <InfoRow label="IOPP Emitido" value={dryDock.iopp_issue_date} />
              <InfoRow label="IOPP Vencimiento" value={dryDock.iopp_exp_date} />
              <InfoRow label="Gestor Técnico" value={dryDock.technical_manager} />
              <InfoRow label="País" value={dryDock.country_name ?? dryDock.country_code} />
              <InfoRow label="Teléfono" value={dryDock.phone} />
              <InfoRow label="Email" value={dryDock.email} />
              <InfoRow label="Dirección" value={dryDock.address} />
              <LinkRow label="Sitio Web" value={dryDock.website} />
              {dryDock.linkedin && <LinkRow label="LinkedIn" value={dryDock.linkedin} />}
              <InfoRow label="Última Actualización" value={dryDock.modified_at?.slice(0, 10)} />
            </SimpleGrid>
          ) : (
            <Text size="sm" c="dimmed">
              Sin datos de dique seco
            </Text>
          )}
        </Card>

        {/* Ownership */}
        <Card withBorder>
          <Title order={4} mb="md">
            Propiedad y Gestión
          </Title>
          {ownershipLoading ? (
            <SimpleGrid cols={{ base: 2, sm: 3 }}>
              {Array.from({ length: 16 }).map((_, i) => (
                <Skeleton key={i} height={40} />
              ))}
            </SimpleGrid>
          ) : ownership ? (
            <Stack gap="md">
              {/* Ownership entities with save buttons */}
              {[
                {
                  label: 'Propietario Beneficiario',
                  role: 'Beneficial Owner',
                  name: ownership.beneficial_owner,
                  country: ownership.beneficial_owner_country,
                },
                {
                  label: 'Operador',
                  role: 'Operator',
                  name: ownership.operator,
                  country: ownership.operator_country,
                },
                {
                  label: 'Gestor Técnico',
                  role: 'Technical Manager',
                  name: ownership.technical_manager,
                  country: ownership.technical_manager_country,
                },
                {
                  label: 'Gestor Comercial',
                  role: 'Commercial Manager',
                  name: ownership.commercial_manager,
                  country: ownership.commercial_manager_country,
                },
              ].map(({ label, role, name, country }) => (
                <Group key={role} justify="space-between" align="flex-end" wrap="wrap">
                  <div>
                    <Text size="xs" c="dimmed">
                      {label}
                    </Text>
                    <Text size="sm" fw={500}>
                      {name || '—'}
                    </Text>
                    {country && (
                      <Text size="xs" c="dimmed">
                        {country}
                      </Text>
                    )}
                  </div>
                  {name && (
                    <SaveContactButton
                      label={role}
                      contact={ownershipContact(name, role, country)}
                    />
                  )}
                </Group>
              ))}

              <Divider />

              {/* Remaining metadata fields */}
              <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }}>
                <InfoRow label="Bandera" value={ownership.flag_name} />
                <InfoRow label="Tipo" value={ownership.vessel_type_code} />
                <InfoRow label="Año de Construcción" value={ownership.built_year} />
                <InfoRow
                  label="DWT"
                  value={ownership.dwt_design != null ? String(ownership.dwt_design) : null}
                />
                <InfoRow label="Clase" value={ownership.class1_code} />
                <InfoRow label="P&I Club" value={ownership.pi_club} />
                <InfoRow label="Comprador" value={ownership.buyer} />
                <InfoRow label="Última Actualización" value={ownership.modified_at?.slice(0, 10)} />
              </SimpleGrid>
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              Sin datos de propiedad
            </Text>
          )}
        </Card>

        {/* Inspection History */}
        <Card withBorder>
          <Title order={4} mb="md">
            Historial de Inspecciones
          </Title>
          {inspectionsLoading ? (
            <Stack gap="xs">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={36} />
              ))}
            </Stack>
          ) : sortedInspections.length === 0 ? (
            <Text size="sm" c="dimmed">
              Sin registros de inspecciones
            </Text>
          ) : (
            <ScrollArea>
              <Table striped withTableBorder withColumnBorders fz="xs" style={{ minWidth: 800 }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Fecha</Table.Th>
                    <Table.Th>Puerto</Table.Th>
                    <Table.Th>Autoridad</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Deficiencias</Table.Th>
                    <Table.Th>Detenido</Table.Th>
                    <Table.Th style={{ minWidth: 200 }}>Descripción</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortedInspections.map((insp) => (
                    <Table.Tr key={insp.id}>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        {insp.inspection_date ?? '—'}
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        {insp.inspection_port ?? '—'}
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        {insp.inspection_authority ?? '—'}
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        {insp.inspection_type ?? '—'}
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        {insp.ship_deficiencies ?? '0'}
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        {insp.detention === '1' ? (
                          <Badge color="red" size="xs">
                            Sí
                          </Badge>
                        ) : (
                          <Text size="xs" c="dimmed">
                            No
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" lineClamp={2} title={insp.deficiency_description ?? ''}>
                          {insp.deficiency_description || '—'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Card>

        {/* Position History */}
        <Card withBorder>
          <Title order={4} mb="md">
            Historial de Posiciones
          </Title>
          {historyLoading ? (
            <Stack gap="xs">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={36} />
              ))}
            </Stack>
          ) : sortedPositions.length === 0 ? (
            <Text size="sm" c="dimmed">
              Sin historial de posiciones disponible
            </Text>
          ) : (
            <>
              <Text size="xs" c="dimmed" mb="xs">
                {history!.positions.length} posiciones registradas — mostrando las{' '}
                {Math.min(sortedPositions.length, 100)} más recientes
              </Text>
              <ScrollArea>
                <Table striped withTableBorder withColumnBorders fz="xs" style={{ minWidth: 700 }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Fecha/Hora (UTC)</Table.Th>
                      <Table.Th>Latitud</Table.Th>
                      <Table.Th>Longitud</Table.Th>
                      <Table.Th>Vel. (kn)</Table.Th>
                      <Table.Th>Rumbo</Table.Th>
                      <Table.Th>Estado</Table.Th>
                      <Table.Th>Destino</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sortedPositions.map((pos, i) => (
                      <Table.Tr key={i}>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          {pos.last_position_UTC}
                        </Table.Td>
                        <Table.Td>{pos.lat.toFixed(4)}</Table.Td>
                        <Table.Td>{pos.lon.toFixed(4)}</Table.Td>
                        <Table.Td>{pos.speed}</Table.Td>
                        <Table.Td>{pos.course}°</Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          {pos.navigation_status || '—'}
                        </Table.Td>
                        <Table.Td>{pos.destination || '—'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </>
          )}
        </Card>

        <Divider />
        <Group>
          <Anchor
            size="sm"
            onClick={() => void navigate({ to: '/vessels' })}
            style={{ cursor: 'pointer' }}
          >
            ← Back to Vessels
          </Anchor>
        </Group>
      </Stack>
    </Container>
  );
}
