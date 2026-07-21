# attachments

Email attachments: operators upload files that get attached to outgoing mail. Files live in MinIO under the `email-attachments/` prefix; the `EmailAttachment` table records metadata and links each file to the dispatch it was sent with (audit trail).

## Scope

- **Roles:** OPS / ADM (both may upload, delete-staged, download, and send with attachments)
- **Key entities:** `email_attachments` (MinIO object key + metadata + nullable FKs to `email_dispatches` / `sh_document_dispatches`)
- **External deps:** MinIO (`StorageService`, global), `@fastify/multipart` (registered in `main.ts`), `EmailService` (nodemailer → `mail.navieramar.com`). Consumed by `dispatch`, `sh-documents`, and `nominations` send flows.
- **Endpoints:** `POST /api/attachments` (multipart, 1 file), `DELETE /api/attachments/:id` (staged only), `GET /api/attachments/:id/download`

## How it flows

1. Browser uploads each selected file → `POST /api/attachments` → stored in MinIO, a **staged** `EmailAttachment` row is created (both dispatch FKs null). Response returns `{ id, filename, mimeType, sizeBytes }`.
2. On send, the compose form submits `attachmentIds: string[]`. The send service (`DispatchService` / `SHDocumentsService` / `NominationsService.sendEmail`) calls `AttachmentsService.resolveForSend(ids)` to pull buffers, appends them to the `EmailService.send` attachments, then `linkTo{Email,ShDocument}Dispatch` stamps the dispatch FK.
3. Staged rows never sent (cancelled composes) are purged after 24h by `AttachmentsCleanupCron` (hourly). Linked rows are permanent (audit).

Limits (in `@portlog/schemas`): 25 MB/file, 25 MB total/email, 10 files/email; MIME allow-list in `ALLOWED_ATTACHMENT_MIME_TYPES`.

## Major changes — repro log

### 2026-07-20 — Add user email attachments (upload → MinIO → attach at send)

Context: allow sending attachments from Portlog emails, stored in the existing MinIO infra. SMTP relay verified to accept attachments before building (see below).

Repro (from repo root, backend + MinIO running via `npm run dev`):

1. Verify the SMTP server accepts attachments (one-off probe, sends a self-test to `prueba@navieramar.com`):
   `node <scratch>/smtp-attachment-probe.mjs` → `250 ... queued`, `rejected: []`
2. Apply the migration + regenerate client:
   `cd backend && npx prisma migrate deploy && npx prisma generate`
3. Auth + upload smoke test:
   ```
   TOKEN=$(curl -s -XPOST localhost:3000/api/auth/login -H 'content-type: application/json' \
     -d '{"email":"ops@portlog.local","password":"portlog_ops_dev"}' | jq -r .accessToken)
   curl -s -XPOST localhost:3000/api/attachments -H "Authorization: Bearer $TOKEN" \
     -F 'file=@some.pdf;type=application/pdf'
   ```

Verify:

- Upload → `HTTP 201` with `{ id, filename, mimeType, sizeBytes }`; disallowed type (`.exe`) → `HTTP 400`.
- `GET /api/attachments/:id/download` → `200`, bytes identical to the uploaded file.
- `DELETE /api/attachments/:id` (staged) → `204`; download again → `404`.
- Backend unit tests: `cd backend && npx jest src/attachments` → 13 passing.

Rollback: revert this migration with a new down-migration dropping `email_attachments` (additive change — no existing tables altered), and remove `AttachmentsModule` from `app.module.ts`.

---
