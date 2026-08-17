import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ServiceRequestCreate,
  ServiceRequestSend,
  ServiceRequestTransition,
  ServiceRequestUpdate,
} from '@portlog/schemas';
import type { ServiceRequestListFilters } from './api';
import {
  addServiceRequestDocuments,
  createServiceRequest,
  deleteServiceRequest,
  getServiceRequest,
  listServiceRequestDispatches,
  listServiceRequests,
  removeServiceRequestDocument,
  sendServiceRequestOrder,
  serviceRequestKeys,
  transitionServiceRequest,
  updateServiceRequest,
} from './api';

// Golden Rule 3 — all server state through TanStack Query, every write
// followed by an explicit invalidation of the caches it can have changed.

export function useServiceRequestList(query: ServiceRequestListFilters) {
  return useQuery({
    queryKey: serviceRequestKeys.list(query),
    queryFn: () => listServiceRequests(query),
  });
}

export function useServiceRequest(id: string | undefined) {
  return useQuery({
    queryKey: serviceRequestKeys.detail(id ?? ''),
    queryFn: () => getServiceRequest(id!),
    enabled: id != null && id !== '',
  });
}

export function useServiceRequestDispatches(id: string | undefined) {
  return useQuery({
    queryKey: serviceRequestKeys.dispatches(id ?? ''),
    queryFn: () => listServiceRequestDispatches(id!),
    enabled: id != null && id !== '',
  });
}

export function useCreateServiceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ServiceRequestCreate) => createServiceRequest(body),
    onSuccess: (created) => {
      qc.setQueryData(serviceRequestKeys.detail(created.id), created);
      void qc.invalidateQueries({ queryKey: serviceRequestKeys.all });
    },
  });
}

export function useUpdateServiceRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ServiceRequestUpdate) => updateServiceRequest(id, body),
    onSuccess: (updated) => {
      qc.setQueryData(serviceRequestKeys.detail(id), updated);
      void qc.invalidateQueries({ queryKey: serviceRequestKeys.all });
    },
  });
}

export function useDeleteServiceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteServiceRequest(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: serviceRequestKeys.all }),
  });
}

export function useTransitionServiceRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ServiceRequestTransition) => transitionServiceRequest(id, body),
    onSuccess: (updated) => {
      qc.setQueryData(serviceRequestKeys.detail(id), updated);
      void qc.invalidateQueries({ queryKey: serviceRequestKeys.all });
    },
  });
}

export function useAddServiceRequestDocuments(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentIds: string[]) => addServiceRequestDocuments(id, attachmentIds),
    onSuccess: (updated) => qc.setQueryData(serviceRequestKeys.detail(id), updated),
  });
}

export function useRemoveServiceRequestDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => removeServiceRequestDocument(id, attachmentId),
    onSuccess: (updated) => qc.setQueryData(serviceRequestKeys.detail(id), updated),
  });
}

export function useSendServiceRequestOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ServiceRequestSend) => sendServiceRequestOrder(id, body),
    onSuccess: (result) => {
      qc.setQueryData(serviceRequestKeys.detail(id), result.request);
      void qc.invalidateQueries({ queryKey: serviceRequestKeys.dispatches(id) });
      void qc.invalidateQueries({ queryKey: serviceRequestKeys.all });
    },
  });
}
