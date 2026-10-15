import { apiRequest } from './client';

/** Retain an unresolved request across remount/reload. Never silently create a
 * new delivery attempt after a timeout or ambiguous server response. */
export async function apiSend<T>(
  path: string,
  body: unknown,
  validate?: (value: unknown) => T,
): Promise<T> {
  const json = JSON.stringify(body ?? null);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${path}\n${json}`),
  );
  const storageKey = `portlog-send:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
  let id: string;
  try {
    id = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
    sessionStorage.setItem(storageKey, id);
  } catch {
    throw new Error(
      'Session storage is required to safely retry sending. Enable it and try again.',
    );
  }
  const result = await apiRequest<T>(path, {
    method: 'POST',
    body: json,
    headers: { 'Idempotency-Key': id },
  });
  // Parsing a receipt can fail after delivery. Keep the key in that case so
  // retry retrieves the same response instead of invoking SMTP again.
  const parsed = validate ? validate(result) : result;
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    /* A retained key is safe. */
  }
  return parsed;
}
