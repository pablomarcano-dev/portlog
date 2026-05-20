import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { FleetEntry } from '@portlog/schemas';

const STORAGE_KEY = 'portlog:fleet:v2';

type FleetMap = Record<string, FleetEntry[]>;
type Listener = () => void;
const listeners = new Set<Listener>();

let mapCache: FleetMap | null = null;
const sliceCache = new Map<string, FleetEntry[]>();
const EMPTY: FleetEntry[] = [];
let storageBound = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function isFleetEntry(e: unknown): e is FleetEntry {
  return (
    !!e &&
    typeof (e as FleetEntry).imo === 'string' &&
    typeof (e as FleetEntry).addedAt === 'number'
  );
}

function parse(raw: string | null): FleetMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const out: FleetMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(v)) continue;
      out[k] = (v as unknown[]).filter(isFleetEntry);
    }
    return out;
  } catch {
    return {};
  }
}

function loadFromStorage(): FleetMap {
  if (!isBrowser()) return {};
  return parse(localStorage.getItem(STORAGE_KEY));
}

function notify(): void {
  listeners.forEach((l) => l());
}

function bindStorageEvent(): void {
  if (storageBound || !isBrowser()) return;
  storageBound = true;
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    mapCache = parse(e.newValue);
    sliceCache.clear();
    notify();
  });
}

function getMap(): FleetMap {
  if (mapCache === null) mapCache = loadFromStorage();
  return mapCache;
}

function setMap(next: FleetMap): void {
  mapCache = next;
  sliceCache.clear();
  if (isBrowser()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  notify();
}

export function getFleet(unlocode: string | null | undefined): FleetEntry[] {
  if (!unlocode) return EMPTY;
  const cached = sliceCache.get(unlocode);
  if (cached) return cached;
  const slice = getMap()[unlocode] ?? EMPTY;
  sliceCache.set(unlocode, slice);
  return slice;
}

export function setFleet(unlocode: string, entries: FleetEntry[]): void {
  const map = getMap();
  if (entries.length === 0) {
    if (!(unlocode in map)) return;
    const { [unlocode]: _drop, ...rest } = map;
    void _drop;
    setMap(rest);
    return;
  }
  setMap({ ...map, [unlocode]: entries });
}

export function getAllFleets(): FleetMap {
  return getMap();
}

export function setAllFleets(map: FleetMap): void {
  setMap(map);
}

export function subscribe(listener: Listener): () => void {
  bindStorageEvent();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

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

const SERVER_EMPTY: FleetEntry[] = [];

export interface UseFleetResult {
  entries: FleetEntry[];
  imos: string[];
  addImos: (input: string) => { added: string[]; invalid: string[] };
  removeImo: (imo: string) => void;
  clearImos: () => void;
  markZarpe: (imo: string) => void;
  clearZarpe: (imo: string) => void;
}

// Fleet vessels that have been categorized as zarpe (departed) for longer than
// this window are dropped by the prune job.
export const ZARPE_PRUNE_TTL_MS = 15 * 24 * 60 * 60 * 1000;
const PRUNE_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Per-port fleet hook. Pass the active port UNLOCODE.
 * Uses useSyncExternalStore for cross-tab synchronization.
 */
export function useFleet(unlocode: string | null | undefined): UseFleetResult {
  const getSnapshot = useCallback(() => getFleet(unlocode), [unlocode]);
  const entries = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_EMPTY);

  const addImos = useCallback<UseFleetResult['addImos']>(
    (input) => {
      const { valid, invalid } = parseImoList(input);
      if (!unlocode) return { added: [], invalid };
      if (valid.length === 0) return { added: [], invalid };

      const current = getFleet(unlocode);
      const existing = new Set(current.map((e) => e.imo));
      const added: string[] = [];
      const now = Date.now();
      const next = [...current];
      for (const imo of valid) {
        if (!existing.has(imo)) {
          next.push({ imo, addedAt: now });
          existing.add(imo);
          added.push(imo);
        }
      }
      setFleet(unlocode, next);
      return { added, invalid };
    },
    [unlocode],
  );

  const removeImo = useCallback<UseFleetResult['removeImo']>(
    (imo) => {
      if (!unlocode) return;
      const current = getFleet(unlocode);
      setFleet(
        unlocode,
        current.filter((e) => e.imo !== imo),
      );
    },
    [unlocode],
  );

  const clearImos = useCallback<UseFleetResult['clearImos']>(() => {
    if (!unlocode) return;
    setFleet(unlocode, []);
  }, [unlocode]);

  const markZarpe = useCallback<UseFleetResult['markZarpe']>(
    (imo) => {
      if (!unlocode) return;
      const current = getFleet(unlocode);
      const idx = current.findIndex((e) => e.imo === imo);
      const entry = current[idx];
      if (idx < 0 || !entry || entry.zarpeSince) return;
      const next = current.slice();
      next[idx] = {
        imo: entry.imo,
        addedAt: entry.addedAt,
        name: entry.name,
        zarpeSince: Date.now(),
      };
      setFleet(unlocode, next);
    },
    [unlocode],
  );

  const clearZarpe = useCallback<UseFleetResult['clearZarpe']>(
    (imo) => {
      if (!unlocode) return;
      const current = getFleet(unlocode);
      const idx = current.findIndex((e) => e.imo === imo);
      const entry = current[idx];
      if (idx < 0 || !entry || !entry.zarpeSince) return;
      const next = current.slice();
      next[idx] = { imo: entry.imo, addedAt: entry.addedAt, name: entry.name };
      setFleet(unlocode, next);
    },
    [unlocode],
  );

  const imos = useMemo(() => entries.map((e) => e.imo), [entries]);

  return { entries, imos, addImos, removeImo, clearImos, markZarpe, clearZarpe };
}

/**
 * Browser-side "job" that drops fleet entries whose zarpeSince is older than
 * `ttlMs`. Sweeps every port-bucket so a single mount is enough — runs on
 * mount and hourly while the app is open.
 */
export function useFleetPruneJob(ttlMs: number = ZARPE_PRUNE_TTL_MS): void {
  useEffect(() => {
    function sweep() {
      const now = Date.now();
      const map = getAllFleets();
      let mutated = false;
      const next: Record<string, FleetEntry[]> = {};
      for (const [port, entries] of Object.entries(map)) {
        const kept = entries.filter((e) => !e.zarpeSince || now - e.zarpeSince < ttlMs);
        if (kept.length !== entries.length) mutated = true;
        if (kept.length > 0) next[port] = kept;
        else mutated = true;
      }
      if (mutated) setAllFleets(next);
    }
    sweep();
    const id = window.setInterval(sweep, PRUNE_SWEEP_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [ttlMs]);
}
