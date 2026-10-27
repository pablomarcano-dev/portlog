import { z } from 'zod';

const EtaTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

export function formatEtaTime(value: Date | null): string {
  return value
    ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
    : '';
}

/** Change the local clock only; preserve the selected date and existing timezone semantics. */
export function withEtaTime(value: Date, time: string): Date | null {
  if (!EtaTimeSchema.safeParse(time).success) return null;
  const hours = Number(time.slice(0, 2));
  const minutes = Number(time.slice(3, 5));
  const result = new Date(value);
  result.setHours(hours, minutes, 0, 0);
  return result;
}
