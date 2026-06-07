import { apiRequest } from '../../lib/api/client';
import {
  NominationListResponseSchema,
  NominationSchema,
  NominationClientSchema,
  type NominationListQuery,
  type NominationListResponse,
  type NominationCreateInput,
  type NominationUpdateInput,
  type NominationStatusTransition,
  type NominationClient,
  type NominationClientCreate,
  type NominationClientUpdate,
  type Nomination,
} from '@portlog/schemas';
import { z } from 'zod';

export const nominationsApi = {
  list: async (q: Partial<NominationListQuery>): Promise<NominationListResponse> => {
    const params = new URLSearchParams();
    if (q.status) params.set('status', q.status);
    if (q.portId) params.set('portId', q.portId);
    if (q.shipParticularId) params.set('shipParticularId', q.shipParticularId);
    if (q.dateFrom) params.set('dateFrom', q.dateFrom.toISOString());
    if (q.dateTo) params.set('dateTo', q.dateTo.toISOString());
    if (q.search) params.set('search', q.search);
    if (q.page) params.set('page', String(q.page));
    if (q.pageSize) params.set('pageSize', String(q.pageSize));
    const raw = await apiRequest<unknown>(`/nominations?${params.toString()}`);
    return NominationListResponseSchema.parse(raw);
  },

  get: async (id: string): Promise<Nomination> => {
    const raw = await apiRequest<unknown>(`/nominations/${id}`);
    return NominationSchema.parse(raw);
  },

  create: async (body: NominationCreateInput): Promise<Nomination> => {
    const raw = await apiRequest<unknown>('/nominations', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NominationSchema.parse(raw);
  },

  update: async (id: string, body: NominationUpdateInput): Promise<Nomination> => {
    const raw = await apiRequest<unknown>(`/nominations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return NominationSchema.parse(raw);
  },

  transition: async (id: string, body: NominationStatusTransition): Promise<Nomination> => {
    const raw = await apiRequest<unknown>(`/nominations/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NominationSchema.parse(raw);
  },

  listClients: async (nominationId: string): Promise<NominationClient[]> => {
    const raw = await apiRequest<unknown>(`/nominations/${nominationId}/clients`);
    return z.array(NominationClientSchema).parse(raw);
  },

  addClient: async (
    nominationId: string,
    data: NominationClientCreate,
  ): Promise<NominationClient> => {
    const raw = await apiRequest<unknown>(`/nominations/${nominationId}/clients`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return NominationClientSchema.parse(raw);
  },

  updateClient: async (
    nominationId: string,
    clientId: string,
    data: NominationClientUpdate,
  ): Promise<NominationClient> => {
    const raw = await apiRequest<unknown>(`/nominations/${nominationId}/clients/${clientId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return NominationClientSchema.parse(raw);
  },

  removeClient: async (nominationId: string, clientId: string): Promise<void> => {
    await apiRequest<unknown>(`/nominations/${nominationId}/clients/${clientId}`, {
      method: 'DELETE',
    });
  },

  updateParcels: async (nominationId: string, parcels: unknown[]): Promise<void> => {
    await apiRequest<unknown>(`/nominations/${nominationId}/parcels`, {
      method: 'PATCH',
      body: JSON.stringify({ parcels }),
    });
  },
};
