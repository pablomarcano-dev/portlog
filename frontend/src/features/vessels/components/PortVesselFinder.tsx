import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Center,
  Checkbox,
  Container,
  Group,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useQueries } from '@tanstack/react-query';
import type {
  PortDetail,
  RadiusVessel,
  Terminal,
  VesselInfo,
  VesselProData,
} from '@portlog/schemas';
import { apiRequest } from '../../../lib/api/client';
import { PortAutocomplete } from './PortAutocomplete';
import { VesselTable } from './VesselTable';
import { FleetPanel } from './FleetPanel';
import { SaveVesselModal } from './SaveVesselModal';
import { useVesselsInRadius } from '../api/useVesselsInRadius';
import { categorizeVessel, isRelevantVessel } from '../lib/categorize';
import { useFleet, useFleetPruneJob } from '../lib/fleet';
import { proToRadiusVessel } from '../lib/proToRadiusVessel';
import { enrichVessel, type EnrichedVessel } from '../lib/types';
import { buildLineupWorkbook, downloadBlob } from '../lib/xlsx';
import { vesselToLineupRow, LINEUP_COLUMNS, DEPARTURE_COLUMNS } from '../lib/export';

const DEFAULT_RADIUS = 8; // nautical miles
const TERMINAL_RADIUS = 5; // nautical miles

const routeApi = getRouteApi('/_protected/vessels/');

interface VesselProResponse {
  data: VesselProData | null;
  meta?: { success: boolean };
}

interface VesselInfoResponse {
  data: VesselInfo | null;
  meta?: { success: boolean };
}

export function PortVesselFinder() {
  useFleetPruneJob();

  const navigate = useNavigate();
  const search = routeApi.useSearch();

  const [selectedPort, setSelectedPort] = useState<PortDetail | null>(null);
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [showArribo, setShowArribo] = useState(true);
  const [showFondeado, setShowFondeado] = useState(true);
  const [showZarpe, setShowZarpe] = useState(true);
  const [etaFilter, setEtaFilter] = useState<Date | null>(null);
  const [cargoFilter, setCargoFilter] = useState('');
  const [selectedImos, setSelectedImos] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [saveTarget, setSaveTarget] = useState<EnrichedVessel | null>(null);

  // Restore port + terminal from URL params on mount / when unlocode changes.
  // A ref prevents double-fetching in React StrictMode's double-invoke.
  const restoringUnlocode = useRef<string | null>(null);
  useEffect(() => {
    const { unlocode, terminal } = search;
    if (!unlocode) return;
    if (selectedPort?.unlocode === unlocode) return;
    if (restoringUnlocode.current === unlocode) return;
    restoringUnlocode.current = unlocode;

    apiRequest<{ data: PortDetail }>(`/datalastic/port?unlocode=${unlocode}`)
      .then((res) => {
        setSelectedPort(res.data);
        if (terminal && res.data.terminals) {
          const term = res.data.terminals.find((t) => t.terminal_code === terminal);
          setSelectedTerminal(term ?? null);
        }
      })
      .catch(() => {
        // Stale unlocode in URL — clear it so the page doesn't look stuck
        void navigate({ to: '/vessels', search: {}, replace: true });
      })
      .finally(() => {
        restoringUnlocode.current = null;
      });
  }, [search.unlocode]); // Only re-run when the URL unlocode changes, not on every selectedPort update

  // Resolve query coords and radius
  const queryLat = selectedTerminal?.lat ?? selectedPort?.lat ?? null;
  const queryLon = selectedTerminal?.lon ?? selectedPort?.lon ?? null;
  const queryRadius = selectedTerminal ? TERMINAL_RADIUS : DEFAULT_RADIUS;

  const { vessels: radiusVessels, isLoading } = useVesselsInRadius(queryLat, queryLon, queryRadius);

  // Fleet integration
  const { imos: fleetImos, addImos, markZarpe, clearZarpe } = useFleet(selectedPort?.unlocode);

  const radiusImoSet = useMemo(() => new Set(radiusVessels.map((v) => v.imo)), [radiusVessels]);

  const fleetImosToFetch = useMemo(
    () => fleetImos.filter((imo) => !radiusImoSet.has(imo)),
    [fleetImos, radiusImoSet],
  );

  // FIX 6: Fetch vessel_pro for fleet IMOs not in radius result
  const fleetProQueries = useQueries({
    queries: (queryLat !== null && queryLon !== null ? fleetImosToFetch : []).map((imo) => ({
      queryKey: ['datalastic', 'vessel_pro', imo],
      queryFn: () => apiRequest<VesselProResponse>(`/datalastic/vessel_pro?imo=${imo}`),
      staleTime: 5 * 60 * 1_000,
      enabled: !!imo,
    })),
  });

  const fleetProMap = useMemo(() => {
    const map = new Map<string, VesselProData>();
    fleetProQueries.forEach((result, i) => {
      const imo = fleetImosToFetch[i];
      if (result.data?.data && imo) {
        map.set(imo, result.data.data);
      }
    });
    return map;
  }, [fleetProQueries, fleetImosToFetch]);

  // Synthesize fleet-only vessels from vessel_pro
  const fleetRadiusVessels = useMemo<RadiusVessel[]>(() => {
    if (queryLat === null || queryLon === null) return [];
    const out: RadiusVessel[] = [];
    for (const [imo, pro] of fleetProMap.entries()) {
      const synth = proToRadiusVessel(imo, pro, queryLat, queryLon);
      if (synth) out.push(synth);
    }
    return out;
  }, [fleetProMap, queryLat, queryLon]);

  const fleetImoSet = useMemo(() => new Set(fleetImos), [fleetImos]);

  // Categorize all vessels (radius + fleet)
  const { arribo, fondeado, zarpe } = useMemo(() => {
    const portName = selectedPort?.port_name ?? '';
    const portUnlocode = selectedPort?.unlocode ?? null;
    const terminalName = selectedTerminal?.terminal_name;
    const etaFilterMs = etaFilter
      ? new Date(etaFilter.toDateString() + ' 23:59:59 UTC').getTime()
      : null;

    const arribo: EnrichedVessel[] = [];
    const fondeado: EnrichedVessel[] = [];
    const zarpe: EnrichedVessel[] = [];
    const processed = new Set<string>();

    function consider(v: RadiusVessel, source: 'radius' | 'fleet') {
      if (processed.has(v.imo)) return;
      processed.add(v.imo);

      if (!isRelevantVessel(v)) return;

      const inFleet = fleetImoSet.has(v.imo);
      const effectiveSource = inFleet ? 'fleet' : source;
      const pro = fleetProMap.get(v.imo);
      const enriched = enrichVessel(v, undefined, { source: effectiveSource, pro });
      const cat = categorizeVessel(v, { portName, portUnlocode, terminalName, pro });

      // Apply cargo type filter
      if (cargoFilter) {
        const cf = cargoFilter.toLowerCase();
        if (!v.type_specific?.toLowerCase().includes(cf) && !v.type?.toLowerCase().includes(cf)) {
          return;
        }
      }

      if (cat === 'arribo') {
        if (etaFilterMs && v.eta_epoch) {
          if (v.eta_epoch * 1000 > etaFilterMs) return;
        }
        arribo.push(enriched);
      } else if (cat === 'fondeado') {
        fondeado.push(enriched);
      } else {
        zarpe.push(enriched);
      }
    }

    for (const v of radiusVessels) consider(v, 'radius');
    for (const v of fleetRadiusVessels) consider(v, 'fleet');

    return { arribo, fondeado, zarpe };
  }, [
    radiusVessels,
    fleetRadiusVessels,
    fleetProMap,
    fleetImoSet,
    selectedPort,
    selectedTerminal,
    etaFilter,
    cargoFilter,
  ]);

  // FIX 6 zarpe effect: stamp fleet vessels leaving, clear when they return
  useEffect(() => {
    if (!selectedPort?.unlocode) return;
    const fleetSet = new Set(fleetImos);
    for (const v of zarpe) if (fleetSet.has(v.imo)) markZarpe(v.imo);
    for (const v of arribo) if (fleetSet.has(v.imo)) clearZarpe(v.imo);
    for (const v of fondeado) if (fleetSet.has(v.imo)) clearZarpe(v.imo);
  }, [arribo, fondeado, zarpe, fleetImos, selectedPort?.unlocode, markZarpe, clearZarpe]);

  function handlePortSelect(port: PortDetail | null) {
    setSelectedPort(port);
    setSelectedTerminal(null);
    setSelectedImos(new Set());
    void navigate({
      to: '/vessels',
      search: port ? { unlocode: port.unlocode } : {},
      replace: true,
    });
  }

  function toggleImo(imo: string) {
    setSelectedImos((prev) => {
      const next = new Set(prev);
      if (next.has(imo)) next.delete(imo);
      else next.add(imo);
      return next;
    });
  }

  // FIX 7: Export handler
  const handleExport = useCallback(async () => {
    const arriboSel = arribo.filter((v) => selectedImos.has(v.imo));
    const fondeadoSel = fondeado.filter((v) => selectedImos.has(v.imo));
    const zarpeSel = zarpe.filter((v) => selectedImos.has(v.imo));
    const selected = [...arriboSel, ...fondeadoSel, ...zarpeSel];
    if (selected.length === 0) return;

    setExporting(true);
    try {
      const imos = selected.map((v) => v.imo);
      const imosNeedingPro = selected.filter((v) => !v.pro).map((v) => v.imo);

      const [proResults, infoResults] = await Promise.all([
        imosNeedingPro.length > 0
          ? Promise.allSettled(
              imosNeedingPro.map((imo) =>
                apiRequest<VesselProResponse>(`/datalastic/vessel_pro?imo=${imo}`),
              ),
            )
          : Promise.resolve([]),
        Promise.allSettled(
          imos.map((imo) => apiRequest<VesselInfoResponse>(`/datalastic/vessel_info?imo=${imo}`)),
        ),
      ]);

      const proMap = new Map<string, VesselProData>();
      (proResults as PromiseSettledResult<VesselProResponse>[]).forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.data) {
          const imo = imosNeedingPro[i];
          if (imo) proMap.set(imo, r.value.data);
        }
      });

      const infoMap = new Map<string, VesselInfo>();
      infoResults.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.data) {
          const imo = imos[i];
          if (imo) infoMap.set(imo, r.value.data);
        }
      });

      const toRow = (v: EnrichedVessel, timeKey: 'ETA' | 'ETD') => {
        const merged = v.pro ? v : { ...v, pro: proMap.get(v.imo) };
        return vesselToLineupRow(merged, { info: infoMap.get(v.imo) }, timeKey);
      };

      const blob = await buildLineupWorkbook({
        sheetName: 'Lineup',
        sections: [
          {
            title: 'EXPECTED ARRIVALS',
            columns: LINEUP_COLUMNS,
            rows: arriboSel.map((v) => toRow(v, 'ETA')),
          },
          {
            title: 'BERTH / ANCHORED',
            columns: LINEUP_COLUMNS,
            rows: fondeadoSel.map((v) => toRow(v, 'ETA')),
          },
          {
            title: 'DEPARTURES',
            columns: DEPARTURE_COLUMNS,
            rows: zarpeSel.map((v) => toRow(v, 'ETD')),
          },
        ],
      });

      const portSlug = (selectedPort?.port_name ?? 'lineup')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(`lineup-${portSlug}-${stamp}.xlsx`, blob);
    } finally {
      setExporting(false);
    }
  }, [arribo, fondeado, zarpe, selectedImos, selectedPort]);

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <Title order={2}>Port Vessel Finder</Title>

        <PortAutocomplete onPortSelect={handlePortSelect} selectedPort={selectedPort} />

        {/* FIX 11: Port info bar */}
        {selectedPort && (
          <Group gap="xs" wrap="wrap">
            <Text size="sm" fw={500}>
              {selectedPort.port_name}
            </Text>
            <Badge variant="outline" size="sm">
              {selectedPort.unlocode}
            </Badge>
            <Text size="xs" c="dimmed">
              País: {selectedPort.country_name}
            </Text>
            <Text size="xs" c="dimmed">
              Tipo: {selectedPort.port_type}
            </Text>
            <Text size="xs" c="dimmed">
              Coord: {selectedPort.lat.toFixed(4)}, {selectedPort.lon.toFixed(4)}
            </Text>
            {selectedPort.area_lvl1 && (
              <Text size="xs" c="dimmed">
                Zona: {selectedPort.area_lvl1}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              Terminales: {selectedPort.terminals?.length ?? 0}
            </Text>
          </Group>
        )}

        {!selectedPort && (
          <Center py="xl">
            <Text c="dimmed" size="sm">
              Search and select a port to see vessels in its vicinity.
            </Text>
          </Center>
        )}

        {selectedPort && (
          <>
            {/* FIX 4: Terminal selector */}
            {selectedPort.terminals && selectedPort.terminals.length > 0 && (
              <Select
                label="Terminal"
                placeholder="Todas las terminales"
                clearable
                data={selectedPort.terminals.map((t) => ({
                  value: t.terminal_code,
                  label: t.terminal_name,
                }))}
                value={selectedTerminal?.terminal_code ?? null}
                onChange={(val) => {
                  if (!val) {
                    setSelectedTerminal(null);
                    void navigate({
                      to: '/vessels',
                      search: { unlocode: selectedPort.unlocode },
                      replace: true,
                    });
                  } else {
                    const term = selectedPort.terminals?.find((t) => t.terminal_code === val);
                    setSelectedTerminal(term ?? null);
                    void navigate({
                      to: '/vessels',
                      search: { unlocode: selectedPort.unlocode, terminal: val },
                      replace: true,
                    });
                  }
                }}
              />
            )}

            {/* FIX 8: ETA filter + cargo type filter */}
            <Group gap="md" align="flex-end">
              <DatePickerInput
                label="ETA hasta"
                placeholder="Filtrar por ETA"
                value={etaFilter}
                onChange={setEtaFilter}
                clearable
                style={{ flex: 1 }}
              />
              <TextInput
                label="Tipo de carga"
                placeholder="Crudo, Fuel Oil..."
                value={cargoFilter}
                onChange={(e) => setCargoFilter(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
            </Group>

            <Group justify="space-between" align="center">
              <Text size="sm" c="dimmed">
                Showing vessels within {selectedTerminal ? TERMINAL_RADIUS : DEFAULT_RADIUS} NM of{' '}
                {selectedTerminal ? selectedTerminal.terminal_name : selectedPort.port_name}
              </Text>

              <Group gap="md">
                {/* FIX 9: Checkboxes instead of segmented control */}
                <Checkbox
                  label={`Arribo (${arribo.length})`}
                  checked={showArribo}
                  onChange={(e) => setShowArribo(e.currentTarget.checked)}
                />
                <Checkbox
                  label={`Fondeado (${fondeado.length})`}
                  checked={showFondeado}
                  onChange={(e) => setShowFondeado(e.currentTarget.checked)}
                />
                <Checkbox
                  label={`Zarpe (${zarpe.length})`}
                  checked={showZarpe}
                  onChange={(e) => setShowZarpe(e.currentTarget.checked)}
                />
              </Group>
            </Group>

            {/* FIX 7: Export button */}
            <Group justify="flex-end">
              {selectedImos.size > 0 && (
                <Button variant="subtle" size="xs" onClick={() => setSelectedImos(new Set())}>
                  Limpiar selección ({selectedImos.size})
                </Button>
              )}
              <Button
                onClick={() => void handleExport()}
                disabled={selectedImos.size === 0 || exporting}
                color="green"
                size="sm"
              >
                {exporting
                  ? `Exportando… (${selectedImos.size})`
                  : `Exportar Excel (${selectedImos.size})`}
              </Button>
            </Group>

            {isLoading && <Skeleton height={200} />}

            {!isLoading && (
              <Stack gap="xl">
                {showArribo && (
                  <VesselTable
                    title="Arribo"
                    vessels={arribo}
                    loading={false}
                    section="arribo"
                    selectedImos={selectedImos}
                    onToggle={toggleImo}
                    onSaveToDb={setSaveTarget}
                    onAddToFleet={(v) => addImos(v.imo)}
                  />
                )}
                {showFondeado && (
                  <VesselTable
                    title="Fondeado"
                    vessels={fondeado}
                    loading={false}
                    section="fondeado"
                    selectedImos={selectedImos}
                    onToggle={toggleImo}
                    onSaveToDb={setSaveTarget}
                    onAddToFleet={(v) => addImos(v.imo)}
                  />
                )}
                {showZarpe && (
                  <VesselTable
                    title="Zarpe"
                    vessels={zarpe}
                    loading={false}
                    section="zarpe"
                    selectedImos={selectedImos}
                    onToggle={toggleImo}
                    onSaveToDb={setSaveTarget}
                    onAddToFleet={(v) => addImos(v.imo)}
                  />
                )}
              </Stack>
            )}

            <FleetPanel unlocode={selectedPort.unlocode} />
          </>
        )}
      </Stack>

      <SaveVesselModal
        vessel={saveTarget}
        opened={saveTarget !== null}
        onClose={() => setSaveTarget(null)}
      />
    </Container>
  );
}
