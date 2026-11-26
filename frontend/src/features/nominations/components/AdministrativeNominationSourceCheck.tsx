import { useState } from 'react';
import { Alert, Badge, Button, Group, Loader, Modal, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { hasManagementAccess, type AdministrativeInstructionDiagnostics } from '@portlog/schemas';
import { useCurrentUser } from '../../../lib/auth/queries';
import { nominationsApi } from '../api';

type Field = AdministrativeInstructionDiagnostics['checks'][number]['field'];
const fields: Record<Field, { label: string; source: string }> = {
  PORT_COSTS_INSTRUCTIONS: {
    label: 'Instrucciones de costos portuarios',
    source: 'Cliente de instrucciones → Instrucciones administrativas',
  },
  OWNER_EXPENSES_INSTRUCTIONS: {
    label: 'Instrucciones de gastos del armador',
    source: 'Cliente de instrucciones → Instrucciones administrativas',
  },
  TECHNICAL_MANAGEMENT_INSTRUCTIONS: {
    label: 'Instrucciones de gestión técnica',
    source: 'Cliente de instrucciones → Instrucciones administrativas',
  },
  PORT_MUNICIPALITY: { label: 'Municipio', source: 'Master Data → Ports → Puerto de operación' },
  PORT_COSTS_BILLING: {
    label: 'Facturación de costos portuarios',
    source: 'Nominación → Destinatarios de facturación → Costos portuarios',
  },
  OWNER_EXPENSES_BILLING: {
    label: 'Facturación de gastos del armador',
    source: 'Nominación → Destinatarios de facturación → Gastos del armador',
  },
  TECHNICAL_MANAGEMENT_BILLING: {
    label: 'Facturación de gestión técnica',
    source: 'Nominación → Destinatarios de facturación → Gestión técnica',
  },
};

/** Read-only diagnostics for Admin and Fleet Manager, enforced on both sides. */
export function AdministrativeNominationSourceCheck({
  nominationId,
  disabled,
}: {
  nominationId: string;
  disabled: boolean;
}) {
  const { data: user } = useCurrentUser();
  const [opened, setOpened] = useState(false);
  const report = useQuery({
    queryKey: ['administrative-ni-source-check', nominationId],
    queryFn: () => nominationsApi.administrativeInstructionDiagnostics(nominationId),
    enabled: opened && hasManagementAccess(user),
    staleTime: 0,
    retry: false,
  });
  if (!hasManagementAccess(user)) return null;
  return (
    <>
      <Button size="xs" variant="default" disabled={disabled} onClick={() => setOpened(true)}>
        Revisar datos
      </Button>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Datos de las instrucciones administrativas"
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm">
            Los campos sin datos guardados se descargan en blanco. Esta revisión no modifica la
            nominación ni completa datos automáticamente.
          </Text>
          {report.isFetching && <Loader size="sm" aria-label="Revisando datos" />}
          {report.isError && (
            <Alert color="red" title="No se pudo revisar los datos">
              <Button size="xs" variant="light" onClick={() => void report.refetch()}>
                Reintentar
              </Button>
            </Alert>
          )}
          {report.data && !report.isFetching && !report.isError && (
            <>
              <Text size="sm">
                <strong>Origen de instrucciones:</strong>{' '}
                {report.data.instructionSource === 'NONE'
                  ? 'No hay cliente de instrucciones ni fletador seleccionado.'
                  : `${report.data.instructionClientName ?? 'Cliente seleccionado'}${report.data.instructionSource === 'CHARTERER_FALLBACK' ? ' (fletador, al no haber cliente de instrucciones)' : ' (cliente de instrucciones)'}`}
              </Text>
              <Text size="xs" c="dimmed">
                El cliente de instrucciones seleccionado tiene prioridad, aunque sus campos estén
                vacíos. Cada categoría de facturación usa su destinatario fiscal guardado en esta
                nominación; no se copia una dirección genérica del cliente.
              </Text>
              <Table withTableBorder verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Campo y origen</Table.Th>
                    <Table.Th>Estado</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {report.data.checks.map((check) => (
                    <Table.Tr key={check.field}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {fields[check.field].label}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {fields[check.field].source}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={check.status === 'POPULATED' ? 'teal' : 'gray'}
                          variant="light"
                        >
                          {check.status === 'POPULATED'
                            ? 'Guardado'
                            : check.status === 'INCOMPLETE'
                              ? 'Incompleto'
                              : 'Sin datos'}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setOpened(false)}>
                  Cerrar
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
