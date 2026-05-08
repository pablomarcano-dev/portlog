# Portlog — Frontend Guide

> Frontend architecture, patterns, and conventions.
> Companion document to [STACK.md](./STACK.md).

---

## Why SPA, Not Next.js

Portlog is an internal tool behind authentication, used by the same ~10 operators every day. The features that justify Next.js do not apply:

- **No SEO** — app sits behind login, no public pages
- **First paint is not critical** — same daily users, browser caches the bundle
- **No public link previews** — internal workflows only
- **No content that benefits from SSR** — every screen is data-driven and authenticated

What Next.js costs in this context:

- Mental overhead of "is this a server or client component?"
- Slower dev server vs Vite
- Heavier deployment (Node.js process vs static files)
- Form libraries occasionally fighting with React Server Components
- Build pipeline complexity

A Vite-built SPA is the right choice: dev server starts in <500ms, HMR is instant, build output is static files served by Nginx.

---

## Frontend Stack

```
Vite                    → dev server + production build
React 19                → UI library
TypeScript (strict)     → type safety end-to-end
TanStack Router         → type-safe routing
TanStack Query          → server state (cache, refetch, mutations)
react-hook-form + zod   → forms + validation
Mantine                 → component library (DataTable, DatePicker built-in)
Tailwind CSS            → utility classes + custom styling
Pino (browser)          → structured client-side logging
```

---

## Why Mantine

Components Portlog needs that ship out-of-the-box with Mantine:

- `DataTable` with sorting/filtering/pagination → nominations list, master data lists
- `DatePicker` / `DateTimePicker` / `TimeInput` → SOF, ETA/ETB, NOR (timestamps everywhere)
- `Modal` / `Drawer` → nested forms (e.g., add owner from inside a nomination)
- `RichTextEditor` → Comments module
- `FileButton` / `Dropzone` → uploads to MinIO
- `Notifications` system → confirmations for WhatsApp/email dispatch
- `Stepper` → multi-step flows (PEDR stages, nomination wizard)

Estimated savings vs starting from shadcn/ui + TanStack Table: **20–30 hours** of component work.

If the design preference leans toward more custom aesthetics and the team accepts building DataTable from TanStack Table primitives, shadcn/ui is the alternative. Both are valid — Mantine is recommended for delivery speed.

---

## Project Structure

```
frontend/
├── src/
│   ├── main.tsx
│   ├── routes/                # File-based routes (TanStack Router)
│   │   ├── __root.tsx         # Root layout
│   │   ├── login.tsx
│   │   ├── _authenticated/    # Auth-required routes
│   │   │   ├── _authenticated.tsx     # Auth guard layout
│   │   │   ├── index.tsx              # Main dashboard
│   │   │   ├── nominations/
│   │   │   │   ├── index.tsx          # List
│   │   │   │   ├── new.tsx            # Create
│   │   │   │   └── $id.tsx            # Detail / edit
│   │   │   ├── master-data/
│   │   │   │   ├── providers/
│   │   │   │   ├── owners/
│   │   │   │   └── ...
│   │   │   ├── pedr/
│   │   │   ├── documents/
│   │   │   └── services/
│   ├── api/                   # Typed API client (fetch wrappers)
│   │   ├── client.ts          # Base client with auth interceptor
│   │   ├── nominations.ts
│   │   ├── ship-particulars.ts
│   │   └── ...
│   ├── hooks/                 # TanStack Query hooks
│   │   ├── useNominations.ts
│   │   ├── useOwners.ts
│   │   └── ...
│   ├── components/
│   │   ├── ui/                # Wrappers around Mantine
│   │   ├── forms/             # Reusable form components
│   │   └── layout/            # Sidebar, topbar, etc.
│   ├── schemas/               # Zod schemas (shared with backend if published as package)
│   │   ├── nomination.ts
│   │   ├── ship-particulars.ts
│   │   └── ...
│   ├── lib/
│   │   ├── auth.ts            # Token storage, refresh logic
│   │   ├── logger.ts          # Pino instance
│   │   └── utils.ts
│   └── styles/
│       └── globals.css
├── public/
├── index.html
├── Dockerfile
├── nginx.conf
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Routing — TanStack Router

File-based routing with full type safety. Search params are typed. Loaders are typed.

### Authenticated layout pattern

`src/routes/_authenticated.tsx`:

```typescript
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { getStoredToken } from '@/lib/auth';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const token = getStoredToken();
    if (!token) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <Sidebar>
      <Outlet />
    </Sidebar>
  );
}
```

Every route under `_authenticated/` inherits the auth guard automatically.

### Route with loader and typed params

`src/routes/_authenticated/nominations/$id.tsx`:

```typescript
export const Route = createFileRoute('/_authenticated/nominations/$id')({
  loader: ({ params, context: { queryClient } }) =>
    queryClient.ensureQueryData(nominationQueryOptions(params.id)),
  component: NominationDetail,
});
```

The `$id` param is typed as `string`. Loaders prefetch via TanStack Query so the component never sees a loading state on navigation.

---

## Server State — TanStack Query

**Every** read uses `useQuery`. **Every** write uses `useMutation`. **Never** `useEffect` for data fetching.

### Query options pattern

Centralize query keys and fetch functions:

```typescript
// src/hooks/useNominations.ts
import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nominationsApi } from '@/api/nominations';

export const nominationsQueryOptions = (filters?: NominationFilters) =>
  queryOptions({
    queryKey: ['nominations', filters],
    queryFn: () => nominationsApi.list(filters),
    staleTime: 30_000,
  });

export const nominationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['nominations', id],
    queryFn: () => nominationsApi.get(id),
  });

export function useCreateNomination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: nominationsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nominations'] });
    },
  });
}
```

### Mutation invalidation

After every mutation, explicitly invalidate affected query keys. This is **non-negotiable** — see Golden Rule 3 in STACK.md.

```typescript
const { mutate } = useCreateNomination();
mutate(data, {
  onSuccess: () => {
    notifications.show({ message: 'Nomination created', color: 'green' });
    navigate({ to: '/nominations' });
  },
});
```

---

## Forms — react-hook-form + Zod

Schemas live in `src/schemas/` and are the single source of truth.

### Schema definition

```typescript
// src/schemas/ship-particulars.ts
import { z } from 'zod';

export const shipParticularsSchema = z.object({
  imo: z.string().regex(/^\d{7}$/, 'IMO must be 7 digits'),
  mmsi: z.string().regex(/^\d{9}$/).optional(),
  name: z.string().min(1).max(100),
  flag: z.string().length(2, 'ISO 3166-1 alpha-2 code'),
  callSign: z.string().min(3).max(10),
  grossTonnage: z.number().positive(),
  netTonnage: z.number().positive(),
  loa: z.number().positive(),         // Length overall
  beam: z.number().positive(),
  draftMax: z.number().positive(),
  yearBuilt: z.number().int().min(1900).max(new Date().getFullYear()),
});

export type ShipParticulars = z.infer<typeof shipParticularsSchema>;
```

### Form component pattern

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextInput, NumberInput, Button } from '@mantine/core';
import { shipParticularsSchema, ShipParticulars } from '@/schemas/ship-particulars';

export function ShipParticularsForm({ onSubmit }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ShipParticulars>({
      resolver: zodResolver(shipParticularsSchema),
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <TextInput
        label="IMO"
        error={errors.imo?.message}
        {...register('imo')}
      />
      <TextInput
        label="Vessel Name"
        error={errors.name?.message}
        {...register('name')}
      />
      <NumberInput
        label="Gross Tonnage"
        error={errors.grossTonnage?.message}
        {...register('grossTonnage', { valueAsNumber: true })}
      />
      <Button type="submit" loading={isSubmitting}>Save</Button>
    </form>
  );
}
```

### Sharing schemas with backend

If the team publishes `@portlog/schemas` as an internal npm package (or uses a monorepo with pnpm workspaces), the backend imports the same Zod schemas and validates request bodies via `nestjs-zod`:

```typescript
// backend
import { shipParticularsSchema } from '@portlog/schemas';
import { createZodDto } from 'nestjs-zod';

class CreateShipParticularsDto extends createZodDto(shipParticularsSchema) {}
```

One schema, two consumers, zero drift.

---

## API Client

Centralized client with auth interceptor and typed responses:

```typescript
// src/api/client.ts
import { getStoredToken, refreshToken } from '@/lib/auth';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    await refreshToken();
    return apiRequest(path, options); // Retry once
  }

  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }

  return response.json();
}
```

---

## Type Safety Across the Stack

The end-to-end type story:

1. **Zod schemas** define the shape of every entity in `src/schemas/`
2. **Backend DTOs** derive from the same schemas via `nestjs-zod`
3. **Prisma types** generated from `schema.prisma`
4. **API responses** typed via the client wrapper
5. **TanStack Query** carries the types into hooks
6. **TanStack Router** types route params and search params
7. **react-hook-form** infers form state from `z.infer<typeof schema>`

If TypeScript compiles, the contract holds from form submission to database write.

---

## Build & Production

### Vite config

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'mantine': ['@mantine/core', '@mantine/hooks', '@mantine/dates'],
          'tanstack': ['@tanstack/react-query', '@tanstack/react-router'],
        },
      },
    },
  },
});
```

### Bundle size targets

- Initial JS payload (gzipped): **< 300 KB**
- Mantine + React + TanStack baseline: ~180 KB gzipped
- Per-route lazy chunks: **< 50 KB** each

If a chunk exceeds these, investigate — likely an unintended import pulling in a large module.

---

## Testing

- **Unit tests**: Vitest for utilities and schemas
- **Component tests**: Vitest + React Testing Library for forms and complex components
- **E2E tests**: Playwright for the critical flows listed in Golden Rule 9

Critical E2E flows that **must** be covered:

1. Login → create nomination → fill ship particulars → submit
2. Create nomination → PEDR pre-arrival → ETA/ETB → NOR → SOF
3. Generate SH-66A document → verify PDF in MinIO → mark as sent
4. Service request → WhatsApp dispatch → confirm delivery status
5. Master data CRUD for each entity (smoke level)

E2E suites run against a Neon preview branch with seeded data.

---

## Logging on the Client

Use `pino` configured for the browser. Every error from a mutation, every API failure, every unhandled promise rejection — logged with context.

```typescript
// src/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  browser: { asObject: true },
  level: import.meta.env.DEV ? 'debug' : 'info',
});
```

In production, ship logs to a service (Sentry, Logtail, or self-hosted Loki).
