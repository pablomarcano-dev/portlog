import { queryOptions } from '@tanstack/react-query';
import { clientsApi } from '../../lib/api/master-data/clients';
import { contactsApi } from '../../lib/api/master-data/contacts';
import { emailGroupsApi } from '../../lib/api/master-data/email-groups';
export const allClientsOptions = () =>
  queryOptions({
    queryKey: ['clients', 'options'],
    queryFn: async () => {
      const items = [];
      let cursor: string | undefined;
      do {
        const page = await clientsApi.list({ limit: 100, cursor });
        items.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      return items;
    },
  });
export const allContactsOptions = () =>
  queryOptions({
    queryKey: ['contacts', 'options'],
    queryFn: async () => {
      const items = [];
      let cursor: string | undefined;
      do {
        const page = await contactsApi.list({ limit: 100, cursor });
        items.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      return items;
    },
  });
export const allEmailGroupsOptions = () =>
  queryOptions({
    queryKey: ['email-groups', 'options'],
    queryFn: async () => {
      const items = [];
      let page = 1;
      let total = 0;
      do {
        const result = await emailGroupsApi.list({ page, pageSize: 100 });
        items.push(...result.items);
        total = result.total;
        page++;
        if (!result.items.length) break;
      } while (items.length < total);
      return items;
    },
  });
