-- M4-S6: Add email_dispatches table for PEDR sub-document email dispatch tracking
-- Applied manually via docker exec (drift fix approach) — same pattern as 20260520_add_fleet_vessels

CREATE TYPE "SubDocType" AS ENUM ('ACKNOWLEDGEMENT', 'PREARRIVAL', 'ETA_ETB', 'NOR', 'SOF', 'CARGO_UPDATE');

CREATE TABLE email_dispatches (
  id             TEXT NOT NULL,
  "pedrId"        UUID NOT NULL,
  "subDocType"    "SubDocType" NOT NULL,
  "toAddresses"   TEXT[] NOT NULL,
  "ccAddresses"   TEXT[] NOT NULL DEFAULT '{}',
  subject        TEXT NOT NULL,
  "bodyHtml"      TEXT,
  "pdfStorageKey" TEXT,
  "sentAt"        TIMESTAMPTZ,
  "sentById"      TEXT NOT NULL,
  error          TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_dispatches_pkey PRIMARY KEY (id),
  CONSTRAINT email_dispatches_pedr_fk FOREIGN KEY ("pedrId") REFERENCES pedrs(id) ON DELETE CASCADE,
  CONSTRAINT email_dispatches_user_fk FOREIGN KEY ("sentById") REFERENCES users(id)
);

CREATE INDEX email_dispatches_pedr_type_idx ON email_dispatches ("pedrId", "subDocType");
