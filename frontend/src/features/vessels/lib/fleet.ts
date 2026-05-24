import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FleetEntry } from '@portlog/schemas';
import { apiRequest } from '../../../lib/api/client';

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function fleetKey(unlocode: string) {
  return ['fleet', unlocode] as const;
}

async function fetchFleet(unlocode: string): Promise<FleetEntry[]> {
  return apiRequest<FleetEntry[]>(`/fleet?unlocode=${encodeURIComponent(unlocode)}`);
}

// ---------------------------------------------------------------------------
// parseImoList — pure util, unchanged
// ---------------------------------------------------------------------------

/** Parse whitespace/comma separated string of IMO numbers */
export function parseImoList(input: string): { valid: string[]; invalid: string[] } {
  const tokens = input
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const t of tokens) {
    if (/^\d{7}$/.test(t)) {
      valid.push(t);
    } else {
      invalid.push(t);
    }
  }
  return { valid, invalid };
}

export const ZARPE_PRUNE_TTL_MS = 15 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// UseFleetResult interface — unchanged so callers need no edits
// ---------------------------------------------------------------------------

export interface UseFleetResult {
  entries: FleetEntry[];
  imos: string[];
  addImos: (input: string) => { added: string[]; invalid: string[] };
  removeImo: (imo: string) => void;
  clearImos: () => void;
  markZarpe: (imo: string) => void;
  clearZarpe: (imo: string) => void;
}

export function useFleet(unlocode: string | null | undefined): UseFleetResult {
  const qc = useQueryClient();

  const { data: entries = [] } = useQuery({
    queryKey: fleetKey(unlocode ?? ''),
    queryFn: () => fetchFleet(unlocode!),
    enabled: !!unlocode,
    staleTime: 30_000,
  });

  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const invalidate = useCallback(() => {
    if (unlocode) void qc.invalidateQueries({ queryKey: fleetKey(unlocode) });
  }, [qc, unlocode]);

  const addMutation = useMutation({
    mutationFn: (imos: string[]) =>
      apiRequest<FleetEntry[]>('/fleet', {
        method: 'POST',
        body: JSON.stringify({ imos, unlocode }),
      }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (imo: string) =>
      apiRequest<void>(`/fleet/${imo}?unlocode=${encodeURIComponent(unlocode ?? '')}`, {
        method: 'DELETE',
      }),
    onSuccess: invalidate,
  });

  const clearMutation = useMutation({
    mutationFn: () =>
      apiRequest<void>(`/fleet?unlocode=${encodeURIComponent(unlocode ?? '')}`, {
        method: 'DELETE',
      }),
    onSuccess: invalidate,
  });

  const zarpeMutation = useMutation({
    mutationFn: ({ imo, departureSince }: { imo: string; departureSince: number | null }) =>
      apiRequest<void>(`/fleet/${imo}`, {
        method: 'PATCH',
        body: JSON.stringify({ unlocode, departureSince }),
      }),
    onSuccess: invalidate,
  });

  const addImos = useCallback<UseFleetResult['addImos']>(
    (input) => {
      const { valid, invalid } = parseImoList(input);
      if (unlocode && valid.length > 0) {
        addMutation.mutate(valid);
      }
      return { added: valid, invalid };
    },
    [unlocode, addMutation],
  );

  const removeImo = useCallback<UseFleetResult['removeImo']>(
    (imo) => {
      if (unlocode) removeMutation.mutate(imo);
    },
    [unlocode, removeMutation],
  );

  const clearImos = useCallback<UseFleetResult['clearImos']>(() => {
    if (unlocode) clearMutation.mutate();
  }, [unlocode, clearMutation]);

  const markZarpe = useCallback<UseFleetResult['markZarpe']>(
    (imo) => {
      if (!unlocode) return;
      const entry = entriesRef.current.find((e) => e.imo === imo);
      if (!entry || entry.departureSince) return;
      zarpeMutation.mutate({ imo, departureSince: Date.now() });
    },
    [unlocode, zarpeMutation],
  );

  const clearZarpe = useCallback<UseFleetResult['clearZarpe']>(
    (imo) => {
      if (!unlocode) return;
      const entry = entriesRef.current.find((e) => e.imo === imo);
      if (!entry || !entry.departureSince) return;
      zarpeMutation.mutate({ imo, departureSince: null });
    },
    [unlocode, zarpeMutation],
  );

  const imos = useMemo(() => entries.map((e) => e.imo), [entries]);

  return { entries, imos, addImos, removeImo, clearImos, markZarpe, clearZarpe };
}

/**
 * Pruning is now handled server-side on every GET /fleet call.
 * This hook is kept as a no-op so callers need no changes.
 */
export function useFleetPruneJob(_ttlMs?: number): void {
  useEffect(() => {}, []);
}
