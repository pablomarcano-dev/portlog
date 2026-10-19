import { Alert, Badge, Container, Group, List, Paper, Stack, Text, Title } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { changelogEntries, CHANGELOG_STATUS } from '../../features/changelog/data';

export const Route = createFileRoute('/_protected/changelog')({
  component: ChangelogPage,
});

function ChangelogPage() {
  return (
    <Container size="lg" py="xl" lang="es">
      <Stack gap="xl">
        <div>
          <Title order={1}>Historial de cambios</Title>
          <Text c="dimmed" mt="xs">
            Novedades de Portlog y estado de su verificación.
          </Text>
        </div>
        {changelogEntries.map((entry) => (
          <Paper
            component="article"
            key={entry.id}
            id={entry.id}
            aria-labelledby={`entry-${entry.id}`}
            withBorder
            radius="md"
            p={{ base: 'md', sm: 'xl' }}
          >
            <Stack gap="lg">
              <Stack gap="xs">
                <Group justify="space-between" gap="sm">
                  <Text component="time" dateTime={entry.date} fw={600} c="blue.7">
                    {entry.dateLabel}
                  </Text>
                  <Badge
                    color={entry.deployment === 'deployed' ? 'green' : 'yellow'}
                    variant="light"
                  >
                    {entry.deployment === 'deployed'
                      ? 'Desplegado en producción'
                      : 'Despliegue pendiente'}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Fecha de referencia: {entry.timeZone}
                </Text>
                <Title order={2} id={`entry-${entry.id}`}>
                  {entry.title}
                </Title>
              </Stack>
              <Alert
                color={entry.deployment === 'deployed' ? 'green' : 'yellow'}
                title="Estado de esta entrada"
              >
                {entry.releaseNote}
              </Alert>
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  Revisión local original de los 13 puntos de la minuta del 5 de octubre
                </Text>
                <Group gap="xs" aria-label="Resumen de verificación local">
                  <Badge color="blue" variant="light">
                    {entry.qaSummary.verified} verificados localmente
                  </Badge>
                  <Badge color="yellow" variant="light">
                    {entry.qaSummary.partial} parcial
                  </Badge>
                  <Badge color="gray" variant="light">
                    {entry.qaSummary.deferred} aplazamientos aprobados
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Este resumen conserva el resultado de la revisión local original. El estado actual
                  del despliegue se indica por separado.
                </Text>
              </Stack>
              {entry.sections.map((section) => (
                <Stack
                  component="section"
                  key={section.id}
                  gap="sm"
                  aria-labelledby={`${entry.id}-${section.id}`}
                >
                  <Title order={3} size="h4" id={`${entry.id}-${section.id}`}>
                    {section.title}
                  </Title>
                  <div>
                    <Badge
                      color={CHANGELOG_STATUS[section.status].color}
                      variant="light"
                      styles={{
                        label: { whiteSpace: 'normal' },
                        root: { height: 'auto', minHeight: 20 },
                      }}
                    >
                      {CHANGELOG_STATUS[section.status].label}
                    </Badge>
                  </div>
                  <List spacing="sm" size="sm">
                    {section.items.map((item) => (
                      <List.Item key={item}>{item}</List.Item>
                    ))}
                  </List>
                  {section.verification && (
                    <Text size="sm" c="dimmed">
                      {section.verification}
                    </Text>
                  )}
                </Stack>
              ))}
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Container>
  );
}
