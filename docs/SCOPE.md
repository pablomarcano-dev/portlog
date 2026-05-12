# Portlog — Module Scope (Living Document)

> High-level scope per module. Intentionally lightweight — sections will be expanded in future sessions.
> Companion to [STACK.md](./STACK.md), [FRONTEND.md](./FRONTEND.md), [DEPLOYMENT.md](./DEPLOYMENT.md), [DEVELOPMENT.md](./DEVELOPMENT.md).

---

## How to Use This Document

Each module follows the same template:

- **Purpose** — what the module does in one or two sentences
- **Milestone** — when it gets delivered (M1–M7)
- **Roles** — which user roles interact with it
- **Key Entities** — main database tables involved
- **Core Workflows** — high-level user flows (to be detailed later)
- **External Dependencies** — third-party services or other modules required
- **Outputs** — documents, notifications, or data produced
- **Open Questions** — placeholders for clarification in upcoming sessions

The "Open Questions" section under each module is where we'll capture decisions to make as we progress.

---

## Module Map

```
Foundation
├── 01. Auth & Users
└── 02. Master Data

Core Domain
├── 03. Nominations
├── 04. Ship Particulars
└── 05. AIS Integration

Operational Workflow
├── 06. PEDR & Port Documents
├── 07. SH-xx Documents
├── 08. Service Requests
└── 09. Financial (PDA/FDA)

Communications
├── 10. Email Dispatch
└── 11. WhatsApp Dispatch

Cross-Cutting
├── 12. SGC Document Storage
├── 13. Audit & Activity Log
└── 14. Reporting & Dashboard
```

---

## 01. Auth & Users

- **Purpose**: Authenticate users, manage two roles (OPS, ADM), enforce authorization across all endpoints.
- **Milestone**: M1
- **Roles**: ADM (full access including user management), OPS (operational access only)
- **Key Entities**: `users`, `refresh_tokens`
- **Core Workflows**:
  - Login / logout
  - Token refresh
  - Password reset (TBD: self-service vs admin-initiated)
  - User creation, edit, deactivation (ADM only)
- **External Dependencies**: None
- **Outputs**: JWT access tokens, refresh tokens
- **Open Questions**:
  - [ ] Self-service password reset via email, or admin-initiated only?
  - [ ] MFA required, optional, or out of scope?
  - [ ] Session timeout / forced logout policy?
  - [ ] Audit log granularity for login events?

**ADR (POR-29, 2026-05-12): Owner permission model**
Decision: `User` gains a `permissions String[] @default([])` field rather than a third role.
Reserved value for M2: `"owner.financial"` — gates access to Owner's `acuerdos` and `historyJson` fields.
Rationale: a string array is more flexible than expanding the `Role` enum, is reversible behind a service-layer check, and avoids a breaking schema change when new fine-grained permissions are needed.
Guard/decorator implementation is deferred to M2-S12 (Owner CRUD story).

---

## 02. Master Data

- **Purpose**: CRUD management of 11 reference entities used across the application.
- **Milestone**: M2
- **Roles**: OPS (read + create + edit), ADM (full including delete)
- **Key Entities** (11 tables):
  - `providers` — service providers
  - `charterers` — vessel charterers
  - `operators` — vessel operators
  - `owners` — vessel owners
  - `shippers` — cargo shippers
  - `agents` — port agents
  - `ports` — port directory
  - `flags` — country flag codes (ISO 3166-1)
  - `cargoes` — cargo type catalog
  - `activities` — operational activity types
  - `contacts` — generic contacts directory
- **Core Workflows**:
  - List / search / filter for each entity
  - Create / edit / soft-delete
  - Inline create from nomination flows ("add owner" without leaving the form)
- **External Dependencies**: None initially; some entities may eventually sync from external registries
- **Outputs**: Reference data consumed by nominations, PEDR, documents
- **Open Questions**:
  - [ ] Should `flags` and `ports` ship pre-seeded with ISO/UN data, or be populated by users?
  - [ ] Soft-delete vs hard-delete policy per entity?
  - [ ] Bulk import (CSV) needed at launch, or future enhancement?
  - [ ] Which entities require historical change tracking?

---

## 03. Nominations

- **Purpose**: Central transactional entity. A nomination represents a vessel call to a port and is the parent of PEDR, documents, and services.
- **Milestone**: M3
- **Roles**: OPS, ADM
- **Key Entities**: `nominations`, `nomination_status_history`, links to `ship_particulars`, `ports`, `charterers`, `owners`, `agents`, `cargoes`
- **Core Workflows**:
  - Create nomination (vessel + port + ETA + parties involved)
  - Edit / amend nomination
  - State transitions (Draft → Confirmed → In Progress → Completed / Cancelled)
  - List + filter by status, port, date range, vessel
  - Detail view as the hub linking to PEDR, documents, services
- **External Dependencies**: AIS Integration (vessel lookup), Master Data
- **Outputs**: Trigger for PEDR creation, source for SH-xx documents
- **Open Questions**:
  - [ ] Exact state machine — full list of states and allowed transitions?
  - [ ] Can a nomination be cloned for repeat calls?
  - [ ] Concurrent edit handling — optimistic locking, or last-write-wins?
  - [ ] Cancellation policy — soft state vs hard delete? Audit trail required?

---

## 04. Ship Particulars

- **Purpose**: Maintain vessel data (IMO, MMSI, dimensions, flag, ownership) used across nominations and documents.
- **Milestone**: M2 (data model) / M3 (full integration)
- **Roles**: OPS, ADM
- **Key Entities**: `ship_particulars`, `ship_particulars_history`
- **Core Workflows**:
  - Lookup by IMO (auto-populate from AIS if available)
  - Manual creation / edit
  - Versioning when key data changes (e.g., ownership transfer, flag change)
- **External Dependencies**: AIS Integration
- **Outputs**: Embedded in nominations, PEDR, SH-xx documents
- **Open Questions**:
  - [ ] What's the canonical list of fields required by Uruguayan port authorities?
  - [ ] Versioning policy — keep historical snapshots, or only audit-log changes?
  - [ ] Photo / certificate attachments scope?

---

## 05. AIS Integration

- **Purpose**: Lookup vessel data from external AIS provider (MarineTraffic or VesselFinder) to auto-populate ship particulars and track positions.
- **Milestone**: M3
- **Roles**: OPS, ADM (consumed implicitly via other modules)
- **Key Entities**: No persistent tables; cache in Redis/memory if needed
- **Core Workflows**:
  - On-demand lookup by IMO/MMSI
  - Background refresh of position for active nominations (TBD)
- **External Dependencies**: MarineTraffic API or VesselFinder API
- **Outputs**: Vessel data to populate Ship Particulars; position data for dashboards
- **Open Questions**:
  - [ ] Provider choice — MarineTraffic vs VesselFinder? Cost per query?
  - [ ] Real-time position tracking required, or one-time lookup at nomination?
  - [ ] Caching strategy and TTL?
  - [ ] Fallback behavior when API is down?

---

## 06. PEDR & Port Documents

- **Purpose**: PEDR (Pedido de Entrada y Despacho de Recalada) is a multi-stage compliance document with sub-documents that track a vessel's lifecycle from arrival through departure.
- **Milestone**: M4
- **Roles**: OPS, ADM
- **Key Entities**: `pedr`, `pedr_stages`, `pedr_sub_documents`, `pedr_events`
- **Core Workflows**:
  - PEDR creation from a nomination
  - Stage progression (pre-arrival → arrival → operations → departure)
  - Sub-document creation per stage (NOR, SOF, etc.)
  - Event logging (timestamps for each operational milestone)
  - State machine enforcement (cannot skip stages)
- **External Dependencies**: Nominations, Master Data, SGC Storage
- **Outputs**: Generated PDFs per sub-document; data feeds into SH-xx generation
- **Open Questions**:
  - [ ] Full list of sub-documents per stage?
  - [ ] Required vs optional events per stage?
  - [ ] Edit policy after a stage is "closed"?
  - [ ] Approval workflow — does ADM need to sign off on stage transitions?

---

## 07. SH-xx Documents

- **Purpose**: Generate official port documents (SH-66A, SH-09A, SH-28A, SH-29A) from PEDR and nomination data, dispatch to authorities, track status.
- **Milestone**: M5
- **Roles**: OPS (generate, send), ADM (full)
- **Key Entities**: `documents`, `document_dispatches`, `document_status_history`
- **Core Workflows**:
  - Generate SH-xx PDF from template + nomination + PEDR data
  - Preview before dispatch
  - Send via email / WhatsApp / manual download
  - Track delivery / read receipts where available
  - "All Sent" dashboard view per nomination
- **External Dependencies**: Puppeteer (PDF generation), Email Dispatch, WhatsApp Dispatch, SGC Storage
- **Outputs**: PDFs in MinIO, dispatch records, notifications
- **Open Questions**:
  - [ ] Exact template specs for each SH-xx form? (canonical PDF samples needed)
  - [ ] Digital signature requirement?
  - [ ] Regeneration policy when source data changes after dispatch?
  - [ ] Authority recipients per document type — fixed list or per-port configuration?

---

## 08. Service Requests

- **Purpose**: Manage operational service requests (launch boats, taxis, supplies, crew transport) tied to a nomination.
- **Milestone**: M6
- **Roles**: OPS, ADM
- **Key Entities**: `service_requests`, `service_request_status_history`, links to `providers`, `activities`
- **Core Workflows**:
  - Create request linked to a nomination
  - Dispatch to a provider via WhatsApp/email
  - Track status (Requested → Confirmed → Completed / Cancelled)
  - Cost recording (feeds into Financial module)
- **External Dependencies**: WhatsApp Dispatch, Email Dispatch, Master Data (providers)
- **Outputs**: Provider notifications, cost line items
- **Open Questions**:
  - [ ] Full taxonomy of service types?
  - [ ] Provider auto-assignment vs manual selection?
  - [ ] Status confirmation — automated via WhatsApp reply parsing, or manual entry?
  - [ ] SLA tracking required?

---

## 09. Financial (PDA / FDA)

- **Purpose**: Generate Proforma Disbursement Account (PDA) before vessel arrival and Final Disbursement Account (FDA) after completion.
- **Milestone**: M6 (light) — may extend to a future phase for full accounting
- **Roles**: ADM primarily; OPS contributes line items
- **Key Entities**: `disbursement_accounts`, `disbursement_line_items`, `tariffs` (TBD)
- **Core Workflows**:
  - PDA generation from nomination + estimated services
  - Line item entry (manual + auto from service requests)
  - FDA generation at nomination close
  - PDF export, send to charterer
- **External Dependencies**: Nominations, Service Requests, Email Dispatch
- **Outputs**: PDA/FDA PDFs, line item records
- **Open Questions**:
  - [ ] Currency handling — single currency, multi-currency with FX?
  - [ ] Tax/VAT treatment?
  - [ ] Tariff catalog — static, or imported from provider price lists?
  - [ ] Integration with external accounting system required?

---

## 10. Email Dispatch

- **Purpose**: Reliably send transactional emails (documents, service requests, notifications) with delivery tracking.
- **Milestone**: M6
- **Roles**: System (consumed by other modules)
- **Key Entities**: `email_dispatches`, `email_templates`
- **Core Workflows**:
  - Render template with data
  - Queue for sending (Bull/BullMQ)
  - Send via SMTP
  - Track delivery / bounce / open (where supported)
  - Retry on transient failure
- **External Dependencies**: SMTP server (SendGrid, AWS SES, or self-hosted)
- **Outputs**: Delivered emails, dispatch records
- **Open Questions**:
  - [ ] SMTP provider choice?
  - [ ] Template engine — Handlebars, MJML, or plain HTML?
  - [ ] Bounce handling and address blacklisting?
  - [ ] Reply parsing in scope?

---

## 11. WhatsApp Dispatch

- **Purpose**: Send WhatsApp messages and documents to providers, authorities, and contacts; capture replies for status updates.
- **Milestone**: M6
- **Roles**: System (consumed by other modules)
- **Key Entities**: `whatsapp_dispatches`, `whatsapp_messages`
- **Core Workflows**:
  - Send text + attachments to a contact
  - Receive replies (webhook)
  - Log all conversations against a nomination/service request
- **External Dependencies**: Twilio WhatsApp Business API, or local WhatsApp Web bridge (architecture TBD)
- **Outputs**: Sent messages, received replies, conversation history
- **Open Questions**:
  - [ ] Twilio Business API vs unofficial WhatsApp Web bridge — cost, reliability, compliance trade-offs?
  - [ ] Template messages for outside-24h-window sends?
  - [ ] Multi-number support (different phones per region)?
  - [ ] Reply-to-status parsing — natural language, keywords, or structured replies only?

---

## 12. SGC Document Storage

- **Purpose**: Centralized document repository (Sistema de Gestión de Calidad) for generated PDFs and uploaded scans, organized by nomination/PEDR.
- **Milestone**: M6
- **Roles**: OPS, ADM (read), system (write)
- **Key Entities**: `documents` table holds metadata; binaries in MinIO
- **Core Workflows**:
  - Upload (manual, from scanner)
  - Auto-store generated PDFs
  - Browse by nomination, by document type, by date
  - Download / preview
  - Versioning when re-generated
- **External Dependencies**: MinIO
- **Outputs**: Stored files, metadata
- **Open Questions**:
  - [ ] Folder structure inside the bucket — by year/nomination, by type, hybrid?
  - [ ] Retention policy?
  - [ ] OCR for uploaded scans in scope?
  - [ ] Public-link generation (signed URLs) for external sharing?

---

## 13. Audit & Activity Log

- **Purpose**: Track who did what, when, across the application for compliance and debugging.
- **Milestone**: M1 (foundation) → enhanced through M6
- **Roles**: ADM (view), system (write)
- **Key Entities**: `audit_log`
- **Core Workflows**:
  - Automatic logging of CRUD operations on critical entities
  - Login/logout events
  - Document dispatch events
  - State transitions
  - View / search / filter by user, entity, date
- **External Dependencies**: None
- **Outputs**: Audit records (immutable)
- **Open Questions**:
  - [ ] Which entities require audit logging? (critical: nominations, PEDR, SH-xx, master data deletes)
  - [ ] Retention period?
  - [ ] Export format for compliance requests?
  - [ ] Tamper-evident chain (hash linking) needed?

---

## 14. Reporting & Dashboard

- **Purpose**: Operational dashboards for OPS, summary reports for ADM. Initial scope is minimal; expand based on user feedback post-launch.
- **Milestone**: M6 (basic) — likely an iteration target post-launch
- **Roles**: OPS (operational views), ADM (everything + financial)
- **Key Entities**: Aggregations over existing tables; possibly materialized views
- **Core Workflows**:
  - "Today's nominations" view
  - "Pending documents" widget
  - "Active services" view
  - Monthly summary reports
- **External Dependencies**: All transactional modules
- **Outputs**: Dashboards, exportable reports
- **Open Questions**:
  - [ ] Required KPIs at launch?
  - [ ] Export formats (PDF, Excel, CSV)?
  - [ ] Custom report builder, or fixed reports?
  - [ ] Real-time vs daily-refresh data?

---

## Cross-Module Concerns to Track

These don't belong to a single module but affect multiple ones. We'll address each in upcoming sessions:

- [ ] **Internationalization** — Spanish-only at launch, or i18n-ready from day one?
- [ ] **Time zones** — UTC storage, local rendering. Confirm port operations time zone (Uruguay is UTC-3).
- [ ] **Date/time format conventions** — DD/MM/YYYY vs ISO display.
- [ ] **Number formatting** — decimal separator, thousands separator (Uruguay uses comma decimal).
- [ ] **Currency** — UYU, USD, multi-currency? Where applicable (Financial, tariffs)?
- [ ] **Print layouts** — separate from web views; needed for SH-xx and PDA/FDA.
- [ ] **Mobile usage** — is the app expected to work on tablets/phones for OPS in the field?
- [ ] **Offline mode** — out of scope, or required for any flow?
- [ ] **Data migration** — is there existing data to import from a previous system?

---

## Next Steps for This Document

In future sessions we'll progressively fill in:

1. **Workflow detail** — sequence diagrams or step-by-step descriptions for the core flows in each module
2. **Entity relationship details** — concrete fields per table, foreign keys, indexes
3. **State machines** — full diagrams for Nominations and PEDR
4. **API contract sketches** — endpoints per module
5. **UI screen list** — mapping the 30 screens to modules
6. **Acceptance criteria** — what "done" means per module

Each pass through this document should resolve a chunk of the open questions and add concrete detail to the "Core Workflows" sections.
