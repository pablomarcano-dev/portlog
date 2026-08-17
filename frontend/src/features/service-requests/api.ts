import {
  ServiceRequestListResponseSchema,
  ServiceRequestReadSchema,
  ServiceRequestDispatchSchema,
  type ServiceRequestCreate,
  type ServiceRequestDispatch,
  type ServiceRequestListQuery,
  type ServiceRequestListResponse,
  type ServiceRequestRead,
  type ServiceRequestSend,
  type ServiceRequestTransition,
  type ServiceRequestUpdate,
} from '@portlog/schemas';
import { z } from 'zod';
import { apiRequest } from '../../lib/api/client';

const BASE = '/service-requests';

/**
 * What the list screen actually holds. `ServiceRequestListQuery` coerces the
 * date filters to `Date` for the API boundary, but the route keeps them as
 * `YYYY-MM-DD` strings (a Date in TanStack Router search params is a new
 * instance on every parse and render-loops the page — see
 * ServiceRequestListSearchSchema). Accept either; both serialise the same.
 */
export type ServiceRequestListFilters = Partial<
  Omit<ServiceRequestListQuery, 'dateFrom' | 'dateTo'>
> & {
  dateFrom?: string | Date;
  dateTo?: string | Date;
};

/**
 * Golden Rule 10 — every response is parsed through its canonical schema
 * before it reaches a component, so a backend shape change surfaces here
 * rather than as an undefined field three renders later.
 */

function toQueryString(query: ServiceRequestListFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, value instanceof Date ? value.toISOString() : String(value));
  }
  return params.toString();
}

export async function listServiceRequests(
  query: ServiceRequestListFilters,
): Promise<ServiceRequestListResponse> {
  const raw = await apiRequest<unknown>(`${BASE}?${toQueryString(query)}`);
  return ServiceRequestListResponseSchema.parse(raw);
}

export async function getServiceRequest(id: string): Promise<ServiceRequestRead> {
  return ServiceRequestReadSchema.parse(await apiRequest<unknown>(`${BASE}/${id}`));
}

export async function createServiceRequest(
  body: ServiceRequestCreate,
): Promise<ServiceRequestRead> {
  const raw = await apiRequest<unknown>(BASE, { method: 'POST', body: JSON.stringify(body) });
  return ServiceRequestReadSchema.parse(raw);
}

export async function updateServiceRequest(
  id: string,
  body: ServiceRequestUpdate,
): Promise<ServiceRequestRead> {
  const raw = await apiRequest<unknown>(`${BASE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return ServiceRequestReadSchema.parse(raw);
}

export async function deleteServiceRequest(id: string): Promise<void> {
  await apiRequest<void>(`${BASE}/${id}`, { method: 'DELETE' });
}

export async function transitionServiceRequest(
  id: string,
  body: ServiceRequestTransition,
): Promise<ServiceRequestRead> {
  const raw = await apiRequest<unknown>(`${BASE}/${id}/transition`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return ServiceRequestReadSchema.parse(raw);
}

/** File already-uploaded attachments against the request (the authorisation letter). */
export async function addServiceRequestDocuments(
  id: string,
  attachmentIds: string[],
): Promise<ServiceRequestRead> {
  const raw = await apiRequest<unknown>(`${BASE}/${id}/documents`, {
    method: 'POST',
    body: JSON.stringify({ attachmentIds }),
  });
  return ServiceRequestReadSchema.parse(raw);
}

export async function removeServiceRequestDocument(
  id: string,
  attachmentId: string,
): Promise<ServiceRequestRead> {
  const raw = await apiRequest<unknown>(`${BASE}/${id}/documents/${attachmentId}`, {
    method: 'DELETE',
  });
  return ServiceRequestReadSchema.parse(raw);
}

const SendResultSchema = z.object({
  request: ServiceRequestReadSchema,
  dispatch: z.object({ id: z.string(), sentAt: z.string().nullable() }),
});
export type SendResult = z.infer<typeof SendResultSchema>;

/** Generate the purchase order and email it to the provider. */
export async function sendServiceRequestOrder(
  id: string,
  body: ServiceRequestSend,
): Promise<SendResult> {
  const raw = await apiRequest<unknown>(`${BASE}/${id}/send`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return SendResultSchema.parse(raw);
}

export async function generateServiceRequestOrder(id: string): Promise<{ minioKey: string }> {
  return apiRequest<{ minioKey: string }>(`${BASE}/${id}/generate`, { method: 'POST' });
}

export async function listServiceRequestDispatches(id: string): Promise<ServiceRequestDispatch[]> {
  const raw = await apiRequest<unknown>(`${BASE}/${id}/dispatches`);
  return z.array(ServiceRequestDispatchSchema).parse(raw);
}

export const serviceRequestKeys = {
  all: ['service-requests'] as const,
  list: (query: ServiceRequestListFilters) => ['service-requests', 'list', query] as const,
  detail: (id: string) => ['service-requests', 'detail', id] as const,
  dispatches: (id: string) => ['service-requests', 'dispatches', id] as const,
};
