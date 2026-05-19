import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { NominationCreateInput } from '@portlog/schemas';
import { nominationsApi } from '../api';

export function useCreateNomination() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (body: NominationCreateInput) => nominationsApi.create(body),
    onSuccess: async (nomination) => {
      void qc.invalidateQueries({ queryKey: ['nominations'] });
      await navigate({
        to: '/nominations/$id',
        params: { id: nomination.id },
      });
    },
  });
}
