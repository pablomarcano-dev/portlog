# Service Requests

Horizontal sales / procurement module. A request hangs off a **vessel**
(`ShipParticular`), not a port call — that is what makes it platform-wide, and
it is the difference from the `Sale` table it replaced (dropped 2026-08-08,
migration `20260808200000_add_service_requests_drop_sales`).

## Language

Code, UI copy and validation messages are **English**, like the rest of Portlog.
The **purchase order PDF and its covering email stay Spanish** — their reader is
the Venezuelan launch/tug/diving provider, the same reason the branch-document
templates (`antidrogas.hbs`, `solicitud-zarpe.hbs`) are Spanish. Every enum
label in `@portlog/schemas` therefore carries both: the UI reads `.en`,
`order-context.ts` reads `.es`.

## Scope

Six request types, driven by the agency's five Spanish specs plus a catch-all:

| Type                    | Spec                                                         |
| ----------------------- | ------------------------------------------------------------ |
| `LAUNCH`                | Solicitud de Servicios de Lanchaje                           |
| `UNDERWATER_INSPECTION` | Solicitud de Inspecciones Técnicas Subacuáticas              |
| `BALLAST_WATER`         | Solicitud de Inspección de Agua de Lastre                    |
| `TUG`                   | Solicitud de Servicio de Remolcadores                        |
| `STS`                   | Solicitud de Operación STS (Ship-to-Ship)                    |
| `GENERAL`               | Ad-hoc paper service voucher — the flow `Sale` used to serve |

One table for all six. Shared fields are real columns on `service_requests`;
only the genuinely type-specific fields live in `details Json`, validated by
`ServiceRequestDetailsSchema` (a Zod discriminated union on `type`) in
`@portlog/schemas`. Same pattern as `SHDocument`.

The four differently-named scheduling fields ("Hora de Zarpe", "Fecha y Hora
Estimada de Inicio", "Fecha y Hora Programada", "Hora de Maniobra") collapse
into one `scheduledAt` column, relabelled per type in the UI. That is what
makes the list screen sortable across types.

## Lifecycle

```
DRAFT ──send──▶ SENT ──transition──▶ COMPLETED
  │               │
  └──── CANCELLED ┘
```

- `DRAFT` — everything editable; the only state that can be deleted.
- `SENT` — the purchase order was generated and emailed. Operational fields
  freeze; `physicalVoucherNo`, `actualCost`, `completedAt` and `notes` stay open
  because they are filled in after the boat comes back
  (`POST_SEND_EDITABLE_FIELDS` in the service).
- The status flips to `SENT` **before** SMTP is attempted and is deliberately
  **not** rolled back on failure — the dispatch row carries the error and the
  operator re-sends by hand. Same contract as `SHDocumentsService.send`.

## The authorisation gate

`requiresAuthorizationDocument(details)` in `@portlog/schemas`:

- `UNDERWATER_INSPECTION`, `BALLAST_WATER`, `STS` → always required
- `LAUNCH` → required for `CREW_TRANSPORT`, `GARBAGE_MARPOL` and the three
  _(Asignada)_ boat types
- `TUG`, `GENERAL` → never

Enforced only on **send**, never on draft save — the request is opened the
moment the vessel calls, long before the authorisation letter arrives. Checked on
the client so the Review step can explain what is missing, and re-checked in
`sendOrder()` because Golden Rule 5 puts authorization in the backend.

## Documents

Authorisation documents reuse the existing `EmailAttachment` plumbing via a new
`serviceRequestId` FK. Two-step: upload to MinIO with `POST /api/attachments`,
then file the returned id with `POST /api/service-requests/:id/documents`.
Unlike the dispatch links, these are **not** consumed at send time — the file
belongs to the request for its whole life and re-attaches to every resend.

## Endpoints

```
GET    /api/service-requests                        list + filters
POST   /api/service-requests                        create (DRAFT)
GET    /api/service-requests/:id
PATCH  /api/service-requests/:id                    guarded once SENT
DELETE /api/service-requests/:id                    DRAFT only
POST   /api/service-requests/:id/transition         COMPLETED | CANCELLED
POST   /api/service-requests/:id/documents          file uploaded attachments
DELETE /api/service-requests/:id/documents/:attId
POST   /api/service-requests/:id/generate           render the order without sending
GET    /api/service-requests/:id/order.pdf
POST   /api/service-requests/:id/send               generate + email the order
GET    /api/service-requests/:id/dispatches         append-only send log
```

Both roles (`OPS`, `ADM`), matching the Sales flow this replaces.

## Control number

`formatControlNumber(correlative, createdAt, branchCode)` → `SN1234/26/PLC`.

⚠️ Minted from this table's **own** `correlative` sequence, so the string can
collide with a nomination's reference built the same way in
`NominationsService`. The agency asked for this format explicitly. Changing the
prefix is a one-line edit in that function — see open question 1 in
`.claude/plans/05-service-requests-module.md`.

## Setup

Nothing beyond the standard dev stack. The purchase order needs Puppeteer's
Chromium (`CHROMIUM_EXECUTABLE_PATH`) and a reachable MinIO bucket; both are
provided by `docker-compose.dev.yml`. Handlebars templates are copied into
`dist` by the `assets` entry in `nest-cli.json` (added 2026-08-08 — before that
only the Dockerfile copied them, so PDF generation failed in local dev).

## Repro log

### 2026-08-08 — module built, verified end to end

Smoke-tested against a scratch database (`portlog_smoke`) seeded with
`prisma/seed.ts`, backend on :3111, Mailhog on :1025:

1. `POST /service-requests` (TUG) → `SN1/26/BBL`, `DRAFT`,
   `authorizationRequired: false`. ✅
2. `POST /service-requests` (STS) → `SN2/26/BBL`, `authorizationRequired: true`. ✅
3. Send the STS with no letter → **400** "This service type requires an
   authority authorisation letter to be uploaded". ✅
4. Create a LAUNCH request carrying a TUG `details` payload → **400**. ✅
5. Send the TUG order → `SENT`, PDF in MinIO, dispatch row with `sentAt`,
   `providerEmails` snapshotted. Mailhog shows subject
   `Orden de Compra SN1/26/BBL — MV Bahamas Merchant — Atraque (Entrada) (×2)`
   (the subject was Spanish at this point; it is English from the language pass on)
   with `OC-SN1-26-BBL.pdf` attached (49 KB). ✅
6. `PATCH` the supplier after send → **409**; `PATCH physicalVoucherNo` +
   `actualCost` after send → **200**. ✅
7. Upload the authorisation letter, file it, send the STS → `SENT`, email carries
   **both** `OC-SN2-26-BBL.pdf` and `capitania.txt`. ✅
8. List / search by control number / filter by type → all correct. ✅

Known gaps at that point: no Cypress coverage, and `details.serviceId` on a
`GENERAL` request is an unenforced reference into the `Service` catalogue (no
FK, because it lives inside the JSON payload).

### 2026-08-08 (later) — language pass and validation messages

- All code, UI copy and Zod messages moved to English; the purchase order and
  its covering email stay Spanish (see **Language** above). Enum labels became
  `{ en, es }` pairs so neither surface can drift from the other.
- Every schema field got an explicit message. Two latent bugs fell out of
  writing the tests for them:
  - `z.coerce.number()` / `z.coerce.date()` coerce **before** validating, so
    `required_error` was unreachable — an empty box reported "Expected number,
    received nan" / "Invalid date". The builders in `fields.ts` normalise blank
    input to `undefined` first, which makes "you left it blank" and "you typed
    nonsense" two different messages again.
  - `nest build` never copied `pdf/templates/**/*.hbs` into `dist`, so PDF
    generation was broken for **every** document type in local dev (only the
    Dockerfile copied them, at line 59). Fixed with an `assets` entry in
    `nest-cli.json`; verified the branch templates land in `dist` too.
