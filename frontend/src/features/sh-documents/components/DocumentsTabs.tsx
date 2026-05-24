import { Tabs, Group, Text, Loader, Alert } from '@mantine/core';
import type { SHDocumentType, SHDocumentDto } from '@portlog/schemas';
import { useShDocuments } from '../api';
import { ShDocStatusBadge } from './ShDocStatusBadge';
import { CommentsTab } from './CommentsTab';
import { Sh66aForm } from './Sh66aForm';
import { Sh09aForm } from './Sh09aForm';
import { SparesForm } from './SparesForm';
import { OthersTab } from './OthersTab';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = 'COMMENT' | 'SH_66A' | 'SH_09A' | 'SH_28A' | 'SH_29A' | 'OTHER';

const TABS: Array<{ id: TabId; label: string; dataCy?: string }> = [
  { id: 'COMMENT', label: 'Comentarios' },
  { id: 'SH_66A', label: 'SH-66A', dataCy: 'sh-tab-66a' },
  { id: 'SH_09A', label: 'SH-09A', dataCy: 'sh-tab-09a' },
  { id: 'SH_28A', label: 'SH-28A', dataCy: 'sh-tab-28a' },
  { id: 'SH_29A', label: 'SH-29A', dataCy: 'sh-tab-29a' },
  { id: 'OTHER', label: 'Otros' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DocumentsTabsProps {
  nominationId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentsTabs({ nominationId }: DocumentsTabsProps) {
  const { data: docs, isLoading, isError, error } = useShDocuments(nominationId);

  if (isLoading) {
    return (
      <Group py="md">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Cargando documentos...
        </Text>
      </Group>
    );
  }

  if (isError) {
    return (
      <Alert color="red" title="Error al cargar documentos">
        {error instanceof Error ? error.message : 'Error inesperado.'}
      </Alert>
    );
  }

  const docsByType = (docs ?? []).reduce<Partial<Record<SHDocumentType, SHDocumentDto>>>(
    (acc, d) => {
      // Keep the first document of each type (most recently created by API sort)
      if (!acc[d.type]) acc[d.type] = d;
      return acc;
    },
    {},
  );

  return (
    <Tabs defaultValue="COMMENT" keepMounted={false}>
      <Tabs.List>
        {TABS.map((tab) => {
          const doc = docsByType[tab.id];
          return (
            <Tabs.Tab key={tab.id} value={tab.id} data-cy={tab.dataCy}>
              <Group gap={6} wrap="nowrap">
                <Text size="sm">{tab.label}</Text>
                {doc && <ShDocStatusBadge status={doc.status} />}
              </Group>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>

      <Tabs.Panel value="COMMENT" pt="xs">
        <CommentsTab
          nominationId={nominationId}
          doc={docsByType['COMMENT'] ?? null}
          isLoading={false}
        />
      </Tabs.Panel>

      <Tabs.Panel value="SH_66A" pt="xs">
        <Sh66aForm
          nominationId={nominationId}
          doc={docsByType['SH_66A'] ?? null}
          isLoading={false}
        />
      </Tabs.Panel>

      <Tabs.Panel value="SH_09A" pt="xs">
        <Sh09aForm
          nominationId={nominationId}
          doc={docsByType['SH_09A'] ?? null}
          isLoading={false}
        />
      </Tabs.Panel>

      <Tabs.Panel value="SH_28A" pt="xs">
        <SparesForm
          nominationId={nominationId}
          doc={docsByType['SH_28A'] ?? null}
          isLoading={false}
          docType="SH_28A"
          title="SH-28A — Repuestos Recibidos"
        />
      </Tabs.Panel>

      <Tabs.Panel value="SH_29A" pt="xs">
        <SparesForm
          nominationId={nominationId}
          doc={docsByType['SH_29A'] ?? null}
          isLoading={false}
          docType="SH_29A"
          title="SH-29A — Repuestos Devueltos"
        />
      </Tabs.Panel>

      <Tabs.Panel value="OTHER" pt="xs">
        <OthersTab
          nominationId={nominationId}
          doc={docsByType['OTHER'] ?? null}
          isLoading={false}
        />
      </Tabs.Panel>
    </Tabs>
  );
}
