export type SofDelayCategory = 'BEFORE' | 'DURING' | 'AFTER';

export interface SofCalculationEntry {
  occurredAt: Date | string;
  activity?: { name: string } | null;
}

export interface SofCalculationRemark {
  beginDate?: string;
  beginTime?: string;
  endDate?: string;
  endTime?: string;
  delayCategory?: SofDelayCategory | null;
}

export interface SofOperationalSummary {
  turnaroundFrom: number | null;
  turnaroundTo: number | null;
  turnaroundMs: number | null;
  laytimeFrom: number | null;
  laytimeTo: number | null;
  laytimeMs: number | null;
  operationFrom: number | null;
  operationTo: number | null;
  grossOperationMs: number | null;
  delaysBeforeMs: number;
  delaysDuringMs: number;
  delaysAfterMs: number;
  netOperationMs: number | null;
  netCargo: number | null;
  averageRate: number | null;
}

const normalized = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function remarkDate(date?: string, time?: string): number | null {
  if (!date) return null;
  const value = new Date(`${date}T${time || '00:00'}:00`).getTime();
  return Number.isFinite(value) ? value : null;
}

function mergeDuration(intervals: Array<[number, number]>): number {
  const sorted = intervals.filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  if (!sorted.length) return 0;
  let total = 0;
  let [start, end] = sorted[0]!;
  for (const [nextStart, nextEnd] of sorted.slice(1)) {
    if (nextStart <= end) end = Math.max(end, nextEnd);
    else {
      total += end - start;
      [start, end] = [nextStart, nextEnd];
    }
  }
  return total + end - start;
}

export function parseSofAmount(value?: string | number | null): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (!value?.trim()) return null;
  const cleaned = value.trim().replace(/\s/g, '');
  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const dotCount = (cleaned.match(/\./g) ?? []).length;
  const singleSeparator = cleaned.match(/^[-+]?\d+([,.])\d+$/)?.[1];
  const trailingDigits = singleSeparator ? (cleaned.split(singleSeparator).at(-1)?.length ?? 0) : 0;
  const decimal =
    commaCount > 1 && dotCount === 0
      ? cleaned.replace(/,/g, '')
      : dotCount > 1 && commaCount === 0
        ? cleaned.replace(/\./g, '')
        : cleaned.includes(',') && cleaned.includes('.')
          ? cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')
            ? cleaned.replace(/,/g, '')
            : cleaned.replace(/\./g, '').replace(',', '.')
          : singleSeparator && trailingDigits === 3
            ? cleaned.replace(singleSeparator, '')
            : cleaned.replace(',', '.');
  const number = Number(decimal);
  return Number.isFinite(number) ? number : null;
}

interface SofFigureData {
  rows?: Record<string, string[]>;
}

export interface SofCargoInputs {
  cargoQuantity: string;
  obq: string;
  cargoSource: 'SHIP_FIGURES' | 'MANUAL';
  obqSource: 'BL_FIGURES' | 'MANUAL';
}

function sumFigureRow(data: SofFigureData | null | undefined, row: string): number | null {
  const amounts = (data?.rows?.[row] ?? [])
    .map(parseSofAmount)
    .filter((amount): amount is number => amount != null);
  return amounts.length ? amounts.reduce((total, amount) => total + amount, 0) : null;
}

/**
 * Connects the operational calculation to the SOF's authoritative figure blocks.
 * Manual values remain a compatibility fallback for older statements which do not
 * yet have Ship/B-L figures recorded.
 */
export function resolveSofCargoInputs(
  shipFiguresData: SofFigureData | null | undefined,
  blFiguresData: SofFigureData | null | undefined,
  manualCargoQuantity = '',
  manualObq = '',
): SofCargoInputs {
  const shipBbls = sumFigureRow(shipFiguresData, 'bbls');
  const originalOnBoard = sumFigureRow(blFiguresData, 'originalOnBoard');
  return {
    cargoQuantity: shipBbls == null ? manualCargoQuantity : String(shipBbls),
    obq: originalOnBoard == null ? manualObq : String(originalOnBoard),
    cargoSource: shipBbls == null ? 'MANUAL' : 'SHIP_FIGURES',
    obqSource: originalOnBoard == null ? 'MANUAL' : 'BL_FIGURES',
  };
}

export function calculateSofOperations(
  entries: SofCalculationEntry[],
  remarks: SofCalculationRemark[],
  cargoQuantity?: string,
  obq?: string,
): SofOperationalSummary {
  const events = entries
    .map((entry) => ({
      at: new Date(entry.occurredAt).getTime(),
      name: normalized(entry.activity?.name ?? ''),
    }))
    .filter((event) => Number.isFinite(event.at));
  const first = (test: (name: string) => boolean) =>
    events.filter((event) => test(event.name)).sort((a, b) => a.at - b.at)[0]?.at ?? null;
  const last = (test: (name: string) => boolean) =>
    events.filter((event) => test(event.name)).sort((a, b) => b.at - a.at)[0]?.at ?? null;

  const eosp = first(
    (name) => name.includes('end of sea passage') || name.includes('end of sea passed'),
  );
  // “Sailed Full Away” is the name used by the current master-data list, while
  // some agencies use “Sailed Full Ahead” for the same turnaround endpoint.
  const sailed = last(
    (name) => name.includes('sailed full ahead') || name.includes('sailed full away'),
  );
  const nor = first((name) => name.includes('notice of readiness') && name.includes('tender'));
  const documents = last(
    (name) => name.includes('document') && (name.includes('on board') || name.includes('deliver')),
  );
  const commenced = first(
    (name) =>
      name.includes('commenced') && (name.includes('loading') || name.includes('discharging')),
  );
  const completed = last(
    (name) =>
      name.includes('completed') && (name.includes('loading') || name.includes('discharging')),
  );
  const span = (start: number | null, end: number | null) =>
    start != null && end != null && end >= start ? end - start : null;

  const intervals = remarks.map((remark) => ({
    category: remark.delayCategory,
    start: remarkDate(remark.beginDate, remark.beginTime),
    end: remarkDate(remark.endDate, remark.endTime),
  }));
  const durationFor = (category: SofDelayCategory, clip = false) =>
    mergeDuration(
      intervals
        .filter((item) => item.start != null && item.end != null)
        .map((item) => {
          let start = item.start!;
          let end = item.end!;

          // Statements saved before delay categories were introduced have no
          // explicit classification. Preserve those records by deriving each
          // applicable portion from the operation boundaries.
          if (item.category == null && commenced != null && completed != null) {
            if (category === 'BEFORE') end = Math.min(end, commenced);
            if (category === 'DURING') {
              start = Math.max(start, commenced);
              end = Math.min(end, completed);
            }
            if (category === 'AFTER') start = Math.max(start, completed);
          } else if (item.category !== category) {
            return [0, 0] as [number, number];
          }

          if (clip && commenced != null && completed != null) {
            start = Math.max(start, commenced);
            end = Math.min(end, completed);
          }
          return [start, end] as [number, number];
        }),
    );

  const grossOperationMs = span(commenced, completed);
  const delaysDuringMs = durationFor('DURING', true);
  const netOperationMs =
    grossOperationMs == null ? null : Math.max(0, grossOperationMs - delaysDuringMs);
  const cargo = parseSofAmount(cargoQuantity);
  const obqAmount = parseSofAmount(obq) ?? 0;
  const netCargo = cargo == null ? null : cargo - obqAmount;
  const netHours = netOperationMs == null ? null : netOperationMs / 3_600_000;

  return {
    turnaroundFrom: eosp,
    turnaroundTo: sailed,
    turnaroundMs: span(eosp, sailed),
    laytimeFrom: nor,
    laytimeTo: documents,
    laytimeMs: span(nor, documents),
    operationFrom: commenced,
    operationTo: completed,
    grossOperationMs,
    delaysBeforeMs: durationFor('BEFORE'),
    delaysDuringMs,
    delaysAfterMs: durationFor('AFTER'),
    netOperationMs,
    netCargo,
    averageRate: netCargo != null && netHours != null && netHours > 0 ? netCargo / netHours : null,
  };
}

export function formatSofCalculationStamp(milliseconds: number | null): string {
  if (milliseconds == null) return 'Pending data';
  const date = new Date(milliseconds);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatSofDuration(milliseconds: number | null): string {
  if (milliseconds == null) return 'Pending data';
  const totalMinutes = Math.floor(milliseconds / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return [days ? `${days}d` : '', `${hours}h`, `${String(minutes).padStart(2, '0')}m`]
    .filter(Boolean)
    .join(' ');
}
