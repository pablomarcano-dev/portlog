import { useNavigate } from '@tanstack/react-router';
import { Alert, Button, Card, Group, Menu, Stack, Text, Title } from '@mantine/core';
import { SERVICE_REQUEST_TYPE_LABELS, toSelectOptions } from '@portlog/schemas';
import { useServiceRequestList } from '../hooks';
import { ServiceRequestTable } from './ServiceRequestTable';

export function VesselServices({ vesselId }: { vesselId: string }) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useServiceRequestList({
    shipParticularId: vesselId,
    page: 1,
    pageSize: 10,
  });
  return (
    <Card withBorder mt="md">
      <Stack>
        <Group justify="space-between">
          <div>
            <Title order={4}>Service requests</Title>
            <Text size="sm" c="dimmed">
              Orders and services for this vessel
            </Text>
          </div>
          <Menu>
            <Menu.Target>
              <Button>Request service</Button>
            </Menu.Target>
            <Menu.Dropdown>
              {toSelectOptions(SERVICE_REQUEST_TYPE_LABELS).map((option) => (
                <Menu.Item
                  key={option.value}
                  onClick={() =>
                    void navigate({
                      to: '/service-requests/new',
                      search: { type: option.value, vesselId },
                    })
                  }
                >
                  {option.label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>
        {isError && <Alert color="red">Could not load vessel services.</Alert>}
        <ServiceRequestTable
          items={data?.items ?? []}
          isLoading={isLoading}
          onRowClick={(id) => void navigate({ to: '/service-requests/$id', params: { id } })}
        />
        <Button
          variant="subtle"
          onClick={() =>
            void navigate({
              to: '/service-requests',
              search: { shipParticularId: vesselId, page: 1, pageSize: 25 },
            })
          }
        >
          View all vessel services and report
        </Button>
      </Stack>
    </Card>
  );
}
