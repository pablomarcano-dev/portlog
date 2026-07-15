import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import type { SaleCreate, SaleUpdate } from '@portlog/schemas';
import { nominationsApi } from '../api';

const salesQueryKey = (nominationId: string) => ['nominations', nominationId, 'sales'] as const;

export function useNominationSales(nominationId: string, enabled = true) {
  return useQuery({
    queryKey: salesQueryKey(nominationId),
    queryFn: () => nominationsApi.listSales(nominationId),
    staleTime: 30_000,
    enabled,
  });
}

export function useAddSale(nominationId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: SaleCreate) => nominationsApi.addSale(nominationId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: salesQueryKey(nominationId) });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to add sale.',
        color: 'red',
      });
    },
  });
}

export function useUpdateSale(nominationId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ saleId, data }: { saleId: string; data: SaleUpdate }) =>
      nominationsApi.updateSale(nominationId, saleId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: salesQueryKey(nominationId) });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to update sale.',
        color: 'red',
      });
    },
  });
}

export function useRemoveSale(nominationId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (saleId: string) => nominationsApi.removeSale(nominationId, saleId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: salesQueryKey(nominationId) });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to remove sale.',
        color: 'red',
      });
    },
  });
}
