import { apiRequest } from '../../lib/api/client';
import {
  NominationListResponseSchema,
  NominationSchema,
  type NominationListQuery,
  type NominationListResponse,
  type NominationCreateInput,
  type NominationUpdateInput,
  type NominationStatusTransition,
  type Nomination,
} from '@portlog/schemas';

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
};
