import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Alert,
  Anchor,
  Button,
  Card,
  Container,
  Divider,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useDatalastic } from '../../../features/vessels/api/useDatalastic';
import type { VesselInfo, VesselOwnership, VesselProData } from '@portlog/schemas';

export const Route = createFileRoute('/_protected/vessels/$imo')({
  component: VesselDetailPage,
});

interface VesselInfoResponse {
  data: VesselInfo;
}

interface OwnershipResponse {
  data: VesselOwnership;
}

interface VesselProResponse {
  data: VesselProData;
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500}>
        {value ?? '—'}
      </Text>
    </div>
  );
}

function VesselDetailPage() {
  const { imo } = Route.useParams();
  const navigate = useNavigate();

  const {
    data: infoRes,
    isLoading: infoLoading,
    isError: infoError,
  } = useDatalastic<VesselInfoResponse>('vessel_info', { imo }, { enabled: /^\d{7}$/.test(imo) });

  const { data: ownershipRes, isLoading: ownershipLoading } = useDatalastic<OwnershipResponse>(
    'ownership',
    { imo },
    { enabled: /^\d{7}$/.test(imo) },
  );

  const { data: proRes, isLoading: proLoading } = useDatalastic<VesselProResponse>(
    'vessel_pro',
    { imo },
    { enabled: /^\d{7}$/.test(imo) },
  );

  const info = infoRes?.data;
  const ownership = ownershipRes?.data;
  const pro = proRes?.data;

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

        <Title order={2}>
          {infoLoading ? <Skeleton height={28} width={300} /> : (info?.name ?? `IMO ${imo}`)}
        </Title>

        {infoError && (
          <Alert color="red" title="Error loading vessel">
            Could not load vessel information for IMO {imo}.
          </Alert>
        )}

        {/* Vessel Specs */}
        <Card withBorder>
          <Title order={4} mb="md">
            Vessel Specifications
          </Title>
          {infoLoading ? (
            <SimpleGrid cols={{ base: 2, sm: 3 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} height={40} />
              ))}
            </SimpleGrid>
          ) : (
            <SimpleGrid cols={{ base: 2, sm: 3 }}>
              <InfoRow label="Name" value={info?.name} />
              <InfoRow label="IMO" value={info?.imo} />
              <InfoRow label="MMSI" value={info?.mmsi} />
              <InfoRow label="Flag" value={info?.country_name} />
              <InfoRow label="Type" value={info?.type_specific || info?.type} />
              <InfoRow label="Callsign" value={info?.callsign} />
              <InfoRow label="Length (m)" value={info?.length} />
              <InfoRow label="Breadth (m)" value={info?.breadth} />
              <InfoRow label="DWT" value={info?.deadweight} />
              <InfoRow label="GRT" value={info?.gross_tonnage} />
              <InfoRow label="Year Built" value={info?.year_built} />
              <InfoRow label="Home Port" value={info?.home_port} />
            </SimpleGrid>
          )}
        </Card>

        {/* Ownership */}
        <Card withBorder>
          <Title order={4} mb="md">
            Ownership
          </Title>
          {ownershipLoading ? (
            <SimpleGrid cols={{ base: 2, sm: 2 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height={40} />
              ))}
            </SimpleGrid>
          ) : (
            <SimpleGrid cols={{ base: 2, sm: 2 }}>
              <InfoRow label="Beneficial Owner" value={ownership?.beneficial_owner} />
              <InfoRow label="Operator" value={ownership?.operator} />
              <InfoRow label="Technical Manager" value={ownership?.technical_manager} />
              <InfoRow label="Commercial Manager" value={ownership?.commercial_manager} />
            </SimpleGrid>
          )}
        </Card>

        {/* Live Position */}
        <Card withBorder>
          <Title order={4} mb="md">
            Current Position
          </Title>
          {proLoading ? (
            <SimpleGrid cols={{ base: 2, sm: 3 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} height={40} />
              ))}
            </SimpleGrid>
          ) : (
            <>
              <SimpleGrid cols={{ base: 2, sm: 3 }}>
                <InfoRow
                  label="Position"
                  value={
                    pro?.lat && pro?.lon
                      ? `${pro.lat.toFixed(4)}, ${pro.lon.toFixed(4)}`
                      : undefined
                  }
                />
                <InfoRow label="Speed (kn)" value={pro?.speed} />
                <InfoRow label="Heading" value={pro?.heading ? `${pro.heading}°` : undefined} />
                <InfoRow label="Destination" value={pro?.destination} />
                <InfoRow label="ETA" value={pro?.eta_UTC} />
                <InfoRow
                  label="Last Update"
                  value={
                    pro?.last_position_epoch
                      ? new Date(pro.last_position_epoch * 1_000).toLocaleString()
                      : undefined
                  }
                />
              </SimpleGrid>
              <Divider my="sm" />
              <Text size="xs" c="dimmed">
                Map coming soon
              </Text>
            </>
          )}
        </Card>

        <Group>
          <Button variant="subtle" onClick={() => void navigate({ to: '/vessels' })}>
            ← Back to Vessels
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
