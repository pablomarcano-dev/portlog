# Client consolidation and database reset plan

Consolidate Clients, Charterers, Shippers, and Operators into the existing `Client` model with an `entityType`. Replace their overlapping fields and relationship patterns with one canonical schema. Implement the final schema, reset the application database, and seed it directly with coherent sample data.

The user has confirmed that existing database contents are disposable **except the currently live Activities and Cargoes catalogs, which must be captured and restored through the seed**. Client-data preservation, backfills, legacy Client ID mappings, dual writes, compatibility APIs, and staged retention of old company tables are not required. Four client email-group selections are required: the current first-message concept plus 2nd Message, 3rd Message, and CC Message.

Implementation is on `codex/unify-clients`. See [implementation and reset runbook](CLIENT_CONSOLIDATION_IMPLEMENTATION.md) for verification and remaining rollout work. The local capture contains 361 Activities and 11 Cargoes. Production was subsequently identified at `167.233.48.84.sslip.io`, and its API lists 181 Activities and 38 Cargoes. A separate production database capture is required before deploying; SSH access is pending. No production database has been reset.

Research baseline: 10 September 2026, Portlog working tree on `main`, commit `04c889c`, including the pre-existing service-request changes. Application repository: `/Users/pablomarcano/Freelance/Portlog`. Findings come from source code, migration history, and inspection of both pages of the retained instruction DOCX. This revision supersedes the earlier data-preserving approach.

## 1. Domain decisions

- One Client directory, service, API, shared form, and company model cover `CLIENT | CHARTERER | SHIPPER | OPERATOR`.
- `Client.entityType` is a classification. A nomination's party role describes what that Client does for that call. The two are independent: a Client classified as Shipper can be selected as Charterer or Operator.
- One company can occupy multiple nomination roles without creating additional Client records. Per-role voyage, reference, proforma, broker, and sort order belong on nomination party rows.
- Every Client has the same available fields, contacts, instructions, tariff structure, and email-group controls. Changing entity type does not clear these values or linked nominations.
- Owners, Agents, Suppliers, and Sales Contacts remain separate entities. Shared Contact readers must adapt to the normalized Contact shape, but this does not expand the company consolidation beyond the requested four entities.
- The existing nomination-level instruction-client choice remains explicit. Its Client supplies the generated document's instructions and four groups. The nomination's charterer assignment points to the same directory but represents another role.

## 2. Repository findings that drive the refactor

Sources: [master-data schema](../backend/prisma/schema/master-data.prisma), [nomination schema](../backend/prisma/schema/nominations.prisma), [nomination validation](../packages/schemas/src/nominations/client.ts), [ClientsService](../backend/src/master-data/clients/clients.service.ts), and [NominationsService](../backend/src/nominations/nominations.service.ts).

| Current issue                                                                                                                     | Consequence for the redesign                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `phone`, `phone2`, `businessPhone`, `homePhone`, `mobile`, `fax`, and `businessFax` overlap                                       | Use a shared typed phone-entry shape for Clients and Contacts                                              |
| `address`, `physicalAddress`, `billingAddress`, `postalAddress`, `taxAddress`, and `otherAddress` encode purposes in column names | Use purpose-labeled address records and shared address formatting                                          |
| Charterer `contactInfo` combines unrelated communication details                                                                  | Replace it with structured company channels and linked people                                              |
| Contact has `shipperId`, `operatorId`, and `charterId`, while Client also has `ClientContact`                                     | Use only `ClientContact` for the four consolidated company types; remove the competing direct affiliations |
| Operator `standardRequirements` overlaps Client `nominationInstructions`                                                          | One canonical `instructions` field for customer-facing standing requirements                               |
| `comments` serves internal notes                                                                                                  | Keep a separate canonical `notes` field; never implicitly include it in customer instructions              |
| Client tariff is serialized JSON inside text; Operator `itemsProforma` is an unimplemented JSON placeholder discarded by CRUD     | Keep one structured tariff collection; remove the unused placeholder                                       |
| Operator `sendCopy` is persisted and shown in UI but has no consumer in recipient resolution                                      | Remove the ineffective toggle; use explicit group selection and documented notice rules                    |
| Nomination validation maps each role to a separate company directory and can clear a link on role change                          | Replace it with a unified Client reference and role-independent validation                                 |
| Generic Client suggestions discard IDs; directory suggestions infer IDs from matching labels                                      | Select by stable ID, display name/type, and support duplicate names safely                                 |
| The DOCX fills 2nd Message, 3rd Message, and CC Message from nomination To/CC/BCC                                                 | Source these sections from the corresponding Client group slots                                            |

The email picker currently lists only the first 100 global groups and deduplicates case-sensitively. It needs contextual Client suggestions, actual search/pagination, and the shared email normalization rules.

Vessel operator assignment, terminal/Shipper notice resolution, master-addressed mail, service-request billing, and public nomination projections all consume these relationships. PEDR and PDF dispatch derive company names from nomination roles. These are part of the regression scope.

The repository's nomination documentation still references a Sales model that is absent from current Prisma/application code. Correct that documentation drift rather than designing a migration for a nonexistent live relation.

## 3. Canonical field model

The following is the proposed final contract, not a union of old columns. Child records structure Client information; they do not introduce another company/party entity alongside Client.

### Client

| Field or collection                     | Purpose and rule                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`, `name`, `entityType`, timestamps  | Company identity; type required, default `CLIENT`; names are not globally unique identifiers                                                           |
| `emails: string[]`                      | Company mailboxes using the existing shared email validator, trimming/lowercasing/deduplication; no parallel singular email or free-text contact field |
| `phones: ClientPhone[]`                 | Typed phone entries with `kind`, `number`, optional `label`, and `sortOrder`                                                                           |
| `addresses: ClientAddress[]`            | Address entries identified by purpose, with one canonical address text per entry                                                                       |
| `contacts` through `ClientContact`      | One company-to-person association model for all four types                                                                                             |
| `instructions: string?`                 | Reusable customer requirements, including the concept previously called Standard Requirements; printed in the instruction DOCX                         |
| `notes: string?`                        | Internal notes, separate from document requirements                                                                                                    |
| `locationType: LOCAL / EXTERIOR / null` | Existing business classification with explicit values; independent of postal address and available to every Client                                     |
| `tariffItems: ClientTariffItem[]`       | Structured rows for the current Item / Amount / Information editor                                                                                     |
| `emailGroups: ClientEmailGroup[]`       | Group assignments identified by one of four message slots                                                                                              |

Use `instructions` consistently in Prisma, shared schemas, API payloads, UI, seed, and document context. With a reset there is no reason to retain a renamed legacy alias or its old mapping. Use the same approach for `notes` and `locationType`.

### Phones and addresses

Use one shared `PhoneEntry` validation/UI shape for ClientPhone and ContactPhone:

- `kind`: `BUSINESS | HOME | MOBILE | FAX | OTHER`.
- `number`: trimmed nonempty text; preserve international prefixes and extensions, without inventing a country code.
- Optional `label`, plus `sortOrder` for stable display.
- A second office number is another BUSINESS row; no `phone2` or `businessPhone2` columns.

Persist these as owned child rows with real parent FKs and cascading deletion. ClientPhone and ContactPhone use the same shape and reusable editor. They have explicit parent FKs rather than an unvalidated polymorphic `(entityType, entityId)` owner.

Use one shared address-entry shape for ClientAddress and ContactAddress: `purpose`, `text`, optional `label`, and `sortOrder`. Supported purposes are `PHYSICAL | BILLING | POSTAL | TAX | OTHER`. Allow at most one of each named purpose per parent; allow multiple OTHER entries with distinguishing labels. Enforce the rule in shared validation and database indexes. This preserves useful address purposes without five competing string columns. Country/street parsing is not required by the current feature and should not be guessed from free text.

Both Clients and Contacts expose the same `emails`, `phones`, and `addresses` property names, shared nested schemas, and editors. Company channels describe the company; a person's channels describe that person. Do not duplicate a person's details into the Client record.

### Contacts and their associations

Keep Contact as the people directory: `id`, `name`, `emails`, `phones`, `addresses`, `notes`, timestamps, and its existing optional Owner relation. Client membership exists exclusively through `ClientContact(clientId, contactId)` with a unique pair.

Remove Contact's `shipperId`, `operatorId`, and `charterId`. Do not add `Contact.clientId` alongside the join table. Remove the old `contacts_single_owner_chk`, since its single-company-affiliation rule is superseded by a many-to-many Client association. A person can be associated with multiple Clients, and an Owner contact can also be associated with a Client.

Replace Contact's category-specific picker with a shared Client multi-select. Query by `clientId` using the join, and optionally by linked Client `entityType` when a directory filter is useful. Owner selection remains explicit and separate. Update any Owner services/UI that render Contact phone/address fields to consume the canonical Contact shape.

Client detail returns one `contacts` collection. The Client and Contact editors update the same join table in transactions. Removing an association does not delete the Contact. Omitted associations on PATCH mean unchanged; an explicit empty array clears them.

No contact is automatically added to all outgoing mail simply because a company is selected. The notice-specific policy below defines when company contacts supply suggested recipients; the user still reviews the draft before sending.

### Instructions, notes, tariffs, and obsolete fields

`standardRequirements` and `nominationInstructions` become one `instructions` field. These are standing customer requirements. Internal comments become `notes`. This is semantic unification, not concatenation of old values; fresh seed data is authored directly in the canonical fields.

Replace text-encoded `tariff` with ClientTariffItem rows: `id`, `clientId`, `item`, `amountText`, `information`, `sortOrder`. The current Amount cell is free text, so `amountText` describes its actual meaning and does not imply a numeric amount with an assumed currency. Financial calculations or currency-aware pricing require a separate explicit contract. Persist rows transactionally and remove JSON parsing/stringification from the tariff UI.

Remove `contactInfo`, all superseded phone/address columns, `legacyEmailGroup`, `standardRequirements`, `nominationInstructions`, `comments` on Client/Contact, `sendCopy`, `itemsProforma`, and text-encoded `tariff` from the final affected schemas/APIs. Meaningful input belongs in the canonical fields above; there is no legacy catch-all JSON/text field.

### Four group selectors backed by one association shape

Use `ClientEmailGroup(clientId, slot, emailGroupId)`, with unique `(clientId, slot)` and `slot = FIRST_MESSAGE | SECOND_MESSAGE | THIRD_MESSAGE | CC_MESSAGE`. Keep EmailGroup and EmailGroupMember as the source of group names and members. The Client UI still presents four fixed selectors.

Each slot is optional; clearing it removes its association. The same group may occupy multiple slots. Deleting a Client or EmailGroup deletes its assignment rows, without deleting an independently shared EmailGroup when a Client is removed. Validate duplicate/unknown slots and invalid group IDs.

This replaces the single existing group FK and avoids four separately implemented relation shapes. The confirmed requirement to keep the existing group means retaining its first-message function, not preserving old rows or field names.

## 4. Nomination relationships, emails, and document output

### Relationships

| Relationship                  | Final model                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Nomination instruction client | `Nomination.clientId → Client`                                                          |
| Nomination charterer role     | `Nomination.chartererId → Client`, explicitly named Prisma relation                     |
| Nomination roster party       | `NominationClient.clientId → Client`, replacing separate Charterer/Shipper/Operator FKs |
| Existing Owner roster party   | Optional `NominationClient.ownerId → Owner`; at most one of Owner or Client per row     |
| Vessel operator role          | `ShipParticular.operatorId → Client`, explicitly named relation                         |
| Company contacts              | `ClientContact` only                                                                    |
| Service-request bill-to       | `ServiceRequest.billToClientId → Client`, retaining its Restrict deletion rule          |

Retain the role-specific relationship names where they convey operational meaning. They no longer reference different company models. Update both nomination editors and backend normalization: editing the role preserves `clientId`; choosing another company changes ID and display name together; deliberately entering a manual name clears the link. Unlinked manual/imported party names remain supported as a workflow, not as legacy migration accommodation.

Keep stable selection IDs separate from labels. Do not constrain Client pickers by the row role. Owner selection remains available without converting Owners into Clients. Validate mutually exclusive linked entities against merged state on partial updates.

### Recipient sources

Use a shared resolver for Client emails and linked Contact emails. Role-specific policy determines which sources to use:

| Notice family               | Suggested sources                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary client notices     | Saved nomination To/CC/BCC arrays                                                                                                |
| ETA to terminal and NOR     | Terminal/port contacts plus the linked Client's company emails in the Shipper role; existing branch/central-office copy rules    |
| ETA request/reply to master | Vessel inbox, vessel operator Client's company and linked Contact emails, Owner Contact emails, and branch/central-office copies |

The operator's Contacts now come exclusively through ClientContact. There is no direct-affiliation fallback. Do not append all contact emails to terminal notices unless their explicit recipient policy calls for them. Changing a Client classification must not change its role's recipient behavior.

Expose the four configured groups as contextual suggestions in nomination creation/edit and compose, while retaining full global group search. Context can include the instruction Client, nomination charterer, linked roster Clients, and vessel operator. Label suggestions with company, role, slot, group name, and member count. Deduplicate shared groups without losing their context labels.

Reuse append/replace actions for To, CC, and BCC. A message-slot name does not force an envelope destination. Resolve current group members when applied, normalize addresses consistently, and leave manually edited recipients unchanged when a group or Client is merely selected or updated elsewhere. Support groups beyond the first page and missing/deleted selections.

Update nomination-aware SH compose surfaces and preserve shared-picker behavior when no nomination context exists. Invalidate relevant Client, Contact, group, roster, detail, and compose queries after changes. Dispatch continues to store resolved addresses and sent content.

### Instruction DOCX

Sources: [renderer](../backend/src/nominations/nomination-instructions-docx.service.ts), [retained two-page template](../backend/src/nominations/templates/nomination-instructions.docx), and `NominationsService.generateNominationInstructions`.

| Template section                       | Canonical source                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1st Message                            | FIRST_MESSAGE group name and ordered members                                                 |
| 2nd Message                            | SECOND_MESSAGE group name and ordered members                                                |
| 3rd Message                            | THIRD_MESSAGE group name and ordered members                                                 |
| CC Message                             | CC_MESSAGE group name and ordered members                                                    |
| Customer Requirements                  | Selected instruction Client's `instructions`                                                 |
| Special Requirements                   | Nomination-specific notes                                                                    |
| Client contact and billing information | Shared formatting of Client channels, linked Contacts, and BILLING address with TAX fallback |

Keep company/contact details in a clearly labeled contact block or continuation when needed, rather than mixing them into the first message's distribution list. Do not use nomination To/CC/BCC as fallback group definitions. Internal `notes` are not automatically printed. Keep the explicit selected instruction Client as the source; do not concatenate every roster Client's requirements.

Adapt every phone/address reader, not just the visible Client form. In particular, the DOCX generator currently reads `phone`, `mobile`, `billingAddress`, `taxAddress`, and Contact business-phone fields directly. Replace these with shared purpose/kind selectors and formatters. Keep current role-name precedence explicit and regression-tested.

Preserve the template branding, headers/footer, and billing layout. Allow full instructions and long lists to continue onto additional pages. The retained blank template rendered as two pages; generated content must be rendered and inspected separately.

## 5. Source areas to change or verify

Paths in this table are relative to the Portlog repository. Directory entries include the corresponding controller, service, module, DTO, and tests.

| Area                         | Files                                                                                                                                                                                                                                                      | Work                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Persistence                  | `backend/prisma/schema/master-data.prisma`, `nominations.prisma`, `email-groups.prisma`, `service-requests.prisma`, new migrations                                                                                                                         | Consolidation, normalized child records, named relations, constraints, billing FK                       |
| Client contract              | `packages/schemas/src/master-data/{client,charterer,shipper,operator}/index.ts`, `master-data/index.ts`                                                                                                                                                    | One schema family; type/filter/group fields; retire old exported entity types                           |
| Related contracts            | `packages/schemas/src/master-data/{contact,ship-particular}/index.ts`, `nominations/{client,schemas}.ts`                                                                                                                                                   | Unified links, role-independent validation, read payloads                                               |
| Shared communication fields  | New phone/address schemas and formatters under `packages/schemas/src/master-data/`, reusable editors under `frontend/src/components/master-data/`                                                                                                          | One nested shape and editor for Client and Contact; canonical purpose/kind selection for consumers      |
| Master-data backend          | `backend/src/master-data/{clients,charterers,shippers,operators}/`, `backend/src/app.module.ts`                                                                                                                                                            | One service/module; remove the three old CRUD implementations                                           |
| Contact/vessel/group backend | `backend/src/master-data/{contacts,ship-particulars,email-groups}/`                                                                                                                                                                                        | ClientContact queries, unified vessel operator, message-slot group associations                         |
| Owner Contact consumers      | `backend/src/master-data/owners/`, `frontend/src/routes/_protected/master-data/owners.tsx`, Owner API types and tests                                                                                                                                      | Adapt Contact projections and formatting where used, without consolidating the Owner entity             |
| Nominations backend          | `backend/src/nominations/nominations.service.ts`, `nominations.controller.ts`, `dto/nomination-client.dto.ts`                                                                                                                                              | Create/update/list links, ID terminology, compose sources, instruction context                          |
| DOCX                         | `backend/src/nominations/nomination-instructions-docx.service.ts`, its spec, `templates/nomination-instructions.docx`, `backend/nest-cli.json`                                                                                                             | Group slots, canonical contact/address formatters, full instructions, template packaging                |
| Master-data UI/API           | `frontend/src/routes/_protected/master-data/{clients,charterers,shippers,operators,contacts,ship-particulars}.tsx`, matching `frontend/src/lib/api/master-data/` clients, `MasterDataTabs.tsx`                                                             | Consolidated editor/directory, type filters, four group selectors, related pickers, old-route redirects |
| Shared selection             | `frontend/src/components/master-data/{ClientNamePicker,ClientPickerModal,ContactNamePicker,EntityPicker,EmailGroupPicker}.tsx`                                                                                                                             | Stable-ID selection and applicable call sites; remove dead helpers only after checking usage            |
| Nomination UI                | `frontend/src/features/nominations/components/{NominationForm,ClientsSection,NewClientModal,NominationInstructionsAction,EmailComposeDrawer}.tsx`, `clientTypeRole.ts`, `hooks/useNominationClients.ts`, `api.ts`, `routes/_protected/nominations/$id.tsx` | Both editors, role independence, instruction-client copy, recipient suggestions and invalidation        |
| Shared email consumers       | `frontend/src/features/sh-documents/components/SendShDocumentDrawer.tsx`, nomination compose/send hooks and backend dispatch paths                                                                                                                         | Preserve existing behavior; pass context where nomination is available                                  |
| Billing/service requests     | `backend/src/service-requests/{service-requests.service,order-context}.ts`, `frontend/src/features/service-requests/{formDefaults,components/ServiceRequestStepper}.tsx`, shared service-request schemas                                                   | Unified bill-to selection and canonical address/contact formatting                                      |
| Public API/documents         | `backend/src/public-api/public-nominations.service.ts`, `backend/src/dispatch/dispatch.service.ts`, `backend/src/pdf/templates/{acknowledgement,nor,cargo-update}.hbs`                                                                                     | Stable public response and operational party text; inspect rather than blindly rewrite                  |
| Fixtures and verification    | `backend/prisma/seed.ts`, `e2e/cypress/tasks/db.ts`, relevant shared/backend/frontend specs, `e2e/cypress/specs/{nominations,eta-recipients,shell}.cy.ts`                                                                                                  | Remove legacy delegates, exercise all four classifications, preserve recipients                         |
| Live reference catalogs      | New export/verification tooling and versioned Activities/Cargoes seed fixtures under `backend/prisma/`                                                                                                                                                     | Capture live catalogs before reset; replace hard-coded catalog seeds and verify exact restoration       |
| Documentation/deployment     | `docs/{SCOPE,PUBLIC_API,USER_MANUAL_MASTER_DATA,USER_MANUAL_NOMINATIONS}.md`, Spanish manuals and generated training assets, backend module docs, `backend/Dockerfile`                                                                                     | Correct model explanations, UI training, migration release procedure                                    |

Regenerate `frontend/src/routeTree.gen.ts` through the router build tooling. Do not hand-edit it. Keep existing applied migration files intact; add a versioned schema refactor migration and reset before seeding. The unrelated Datalastic response field named `operator` describes external source data and does not need renaming merely because the internal model changes.

## 6. Reset and implementation sequence

### Required prerequisite — Capture live Activities and Cargoes

Before any database reset, export the complete Activities and Cargoes catalogs from the actual live Portlog database, not from the current hard-coded seed or a development copy. Verify the source environment without storing connection credentials in fixtures. This preservation requirement applies to these two catalogs only; their dependent historical SOF/nomination records do not need to survive.

Capture all persisted catalog fields:

| Catalog  | Fields                                                                    |
| -------- | ------------------------------------------------------------------------- |
| Activity | `id`, `name`, `comments`, `createdAt`, `updatedAt`                        |
| Cargo    | `id`, `name`, `bblUnit`, `category`, `comments`, `createdAt`, `updatedAt` |

Keep exact IDs, names, spelling/case, nulls, units, SN/OT categories, comments, and timestamp precision. Cargo names are not unique: preserve separate rows even when names match. Do not rename, deduplicate, normalize, or supplement these catalog records with sample entries as part of this refactor. Check the actual schema for any additional persisted catalog fields when exporting and include them if present.

Save the validated exports as durable, versioned seed fixtures outside the database that will be reset, with a manifest recording source environment identifier, capture time, schema version, row counts, and checksums. Validate fixture structure and reload it successfully before declaring the export usable. Export both tables from a consistent read-only snapshot. If initial capture precedes implementation, freeze catalog edits and recapture/verify at cutover so changes made in the meantime are included.

**Reset gate:** the destructive reset step must fail before dropping anything if either live-catalog fixture or its verified manifest is missing, invalid, or stale relative to the final frozen source. Do not fall back to bundled sample catalogs when capture is unavailable. Retain the verified fixtures through subsequent retries and resets.

### Phase 1 — Final schema and shared contracts

Implement the final canonical Client/Contact models, phone/address child rows, tariff rows, message-slot assignments, and nomination/vessel relations. Build shared nested schemas and display/selection helpers. Require one data shape across all four classifications and both company/people communication editors.

Create a new versioned schema migration that removes superseded models/columns and introduces the final relations. Existing applied migration files remain unchanged; an empty database can replay their history and then apply this schema refactor before the new seed runs. There is no copy/backfill SQL and no requirement to support a populated database upgrade. Historical migration files may mention old tables; the resulting schema must not contain them.

Define transaction and PATCH semantics for owned child collections: omitted means unchanged, an explicit empty array clears, and submitted row IDs must belong to the parent being edited. Use nullable scalars for deliberate clearing. Cascade owned detail rows and join associations; maintain role-specific SetNull and billing Restrict behavior.

### Phase 2 — Unified services and forms

Refactor ClientsService and ContactsService around the canonical contract, including nested writes, read projections, search, group slots, and associations. Adapt vessel/operator and Owner Contact readers. Use one full Client form and a quick-create form sharing its field components and validation. Group fields by identity, communication, contacts, instructions, tariff, and message groups.

Remove the Charterer/Shipper/Operator backend modules, DTOs, API clients, shared schema exports, and independent editors. Update all repository callers. No compatibility adapter or dual-write period is needed. Old browser routes may redirect to Clients with an optional type filter; do not retain separate CRUD implementations.

### Phase 3 — Nomination, email, document, and billing consumers

Update both nomination editors, role/link normalization, vessel operator selection, Client/contact/group lookups, compose resolution, and instruction DOCX formatting. Adjust service-request Client summaries and bill-to pickers to the new contact/address shape. Retain the public API's explicit projected response and operational role labels.

Integrate with the pre-existing service-request working-tree changes without discarding them. Regenerate the Prisma client and router route tree through their normal build tools.

### Phase 4 — Rewrite seed and fixtures

Seed directly into the normalized schema in dependency order:

1. Restore Activities and Cargoes exactly from the verified live fixtures; seed required users, roles, other reference data, and EmailGroups/members.
2. Unified Clients spanning all four entity types, with canonical phone/address/instruction/tariff data.
3. Contacts and ClientContact associations; retain separately scoped Owner fixtures where needed.
4. ClientEmailGroup assignments covering all four slots.
5. Vessels referencing unified operator Clients; nominations with Client/Owner party links.
6. Service requests and other dependent operational sample records.

Use explicit fixture IDs or stable fixture keys for rerunnable seeds. Do not identify a company solely by its display name. Seed one company once and reuse it in multiple operational roles. Add examples of one person linked to multiple Clients, a Client selected in a role different from its classification, duplicate display names with distinct IDs, multiple phones/address purposes, empty optional fields, and all four populated group slots.

Replace the current Activity name-array/upsert loop and the ten hard-coded Cargo examples in `backend/prisma/seed.ts` with fixture-driven inserts/upserts keyed by the exported IDs. Insert every catalog field explicitly, including timestamps, on initial restoration. On seed reruns, existing catalog IDs should be left unchanged; do not overwrite subsequent user edits. Fail visibly on conflicting identities rather than silently matching by name. Verify exact equality on a fresh reset and verify that an immediate second seed run makes no changes.

Dependent sample nominations, parcels, and SOF rows must select real entries from the restored catalogs. Remove assumptions about sample product names or eligible OT products. If a needed demo category/activity is absent, adapt or skip that demo; keep synthetic test-only catalogs confined to isolated test databases. Do not add fake rows to the restored live catalogs to make fixtures pass.

Include coherent document and recipient examples with synthetic test addresses. Seeding and smoke tests must not send external mail. Update E2E setup/cleanup to use the unified delegates and relationship order. A second seed run should not create duplicate companies, contacts, links, or group-slot assignments.

### Phase 5 — Reset, seed, and verify

Once the implementation and seed are ready, stop the application writers/workers for the designated Portlog environment, finalize and verify the live Activities/Cargoes snapshot, pass the reset gate, reset its application database, apply the versioned migrations, and run the rewritten seed. The two catalogs and their IDs must survive through their seed fixtures; other existing operational rows and dispatch history may be discarded. Check the target connection explicitly so the reset applies only to the intended application environment.

Run the fresh-database acceptance checks below, start the matching backend/frontend, and refresh browser sessions. The backend Docker startup already runs `prisma migrate deploy`; keep database reset and seed as explicit setup/deployment steps, never an unconditional action on every startup.

There is no later legacy-table cleanup release: the final schema and application ship together. If verification fails, fix the implementation/seed and reset again using the retained verified live-catalog fixtures. Do not replace those fixtures by exporting an incomplete reseeded database. Old-version recovery, if needed, is likewise a matched code/schema/seed setup that includes the preserved catalogs, not a reversal of migrated Client data.

## 7. Acceptance criteria

### Model and reset

- Reset → migrations → seed → application start succeeds from an empty database.
- The final schema contains one Client model for all four types and none of their old company tables or redundant field aliases.
- No legacy Client data mapping or whole-database restoration is needed; the live Activities/Cargoes fixtures are required seed inputs.
- Immediately after a fresh reset/seed, both catalogs match the final live snapshot field for field and by ID, row count, and canonical content checksum, including timestamp precision. There are no omitted or extra sample rows. OT eligibility and cargo units are unchanged.
- Reset is blocked when the required catalog capture is missing, invalid, or stale. An immediate second seed run leaves both restored catalogs unchanged; later seed runs do not overwrite user edits.
- Seed reruns are deterministic and do not duplicate associations; all FKs, owned child rows, slot uniqueness, and address-purpose rules are valid.
- Client deletion still respects service-request billing restrictions; unlinking a Contact does not delete the person or their other associations.

### Canonical fields and contacts

- All four types use the same form and create/read/update schemas. Type changes retain all populated information.
- Multiple typed phones and address purposes save, clear, reorder, and display consistently on both Clients and Contacts.
- `instructions` supplies document requirements; `notes` stays internal. No separate standard-requirements, legacy-contact-info, or legacy-group field remains.
- Tariff rows round-trip as structured records, including free-text amount descriptions, without JSON encoded in strings.
- A Contact can be linked to multiple Clients through the one association path. Both editors see the same links. Owner Contact readers handle the canonical communication shape.
- Partial nested updates distinguish unchanged versus clear; attempts to edit another parent's child rows fail.

### Nomination and recipients

- Exercise all four Client types across Charterer, Shipper, Operator, and generic Client uses through both editors and the API.
- Role/type changes preserve linked identity; duplicate labels never cause implicit first-match selection. One Client may occupy multiple rows with distinct per-role references.
- Manual/imported names and separate Owner selection still work, including merged-state validation of the roster's single linked entity.
- All four groups are searchable/selectable from nomination compose, including beyond the first list page. Append/replace and address deduplication work for To/CC/BCC.
- Groups and contact edits appear when a new draft is opened/applied; they do not silently rewrite saved recipients.
- Terminal/NOR, master-addressed, ordinary-client, branch-copy, and central-office BCC behavior follows the role-specific source table above. Operator contacts resolve only through ClientContact.
- OPS/ADM access rules and ADM-only master-data deletion remain enforced by the backend.

### DOCX and downstream behavior

- Each message slot prints the corresponding group and its ordered members. CC Message never takes its value from nomination BCC.
- Every entity type can supply the selected instruction Client; full `instructions` text appears separately from nomination-specific notes.
- Shared formatters select the intended phone kinds and billing/address purposes. Linked person details are not lost or mixed into unrelated group slots.
- Render generated DOCX examples with long instructions/groups, accents, special characters, missing slots, and groups repeated across slots. Inspect all pages for overflow, missing content, and template damage.
- Verify nomination party names, vessel operator output, bill-to/service order output, public API projections, and PEDR/acknowledgement/NOR/cargo-update/SH paths.

Update shared-schema tests, ClientsService/ContactsService/vessel service tests, nomination role/link tests, group-picker tests, DOCX context/render tests, and E2E nomination/recipient fixtures. Remove assertions that require the old role-directory restriction or direct Contact affiliations. Run shared-schema build, Prisma generation, workspace typecheck/build/lint, affected tests, isolated E2E flows, and rendered DOCX verification.

## 8. Implementation boundaries

Confirmed scope: reset and reseed with mandatory preservation of the currently live Activities and Cargoes through seed fixtures; other existing data is disposable. One normalized Client entity with a type; four client message groups usable from nominations and printed in the instruction DOCX.

Design defaults in this plan: one classification per company, one ClientContact association mechanism, typed phones/addresses, shared `instructions` and internal `notes`, structured tariff rows, and slot-based email-group assignments. These are proposed implementation choices that carry out the user's normalization requirement, not requirements to preserve the old schema.

Owners and other company directories remain separate; their Contact consumers adapt where necessary. Numeric/currency-aware tariff calculation, broader financial redesign, and combining instructions from several Clients are outside this refactor. Database migration-history squashing is unnecessary for a reset and is not part of this plan.

Only repository research and this plan revision have been completed. Live catalog export has not yet been performed. Capture and verify Activities/Cargoes before any reset; implementation, seeding, and runtime verification remain execution steps.
