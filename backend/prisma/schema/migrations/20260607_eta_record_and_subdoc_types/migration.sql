-- Add new ETA email sub-document types to SubDocType enum
ALTER TYPE "SubDocType" ADD VALUE IF NOT EXISTS 'ETA_REQUEST';
ALTER TYPE "SubDocType" ADD VALUE IF NOT EXISTS 'ETA_TERMINAL';
ALTER TYPE "SubDocType" ADD VALUE IF NOT EXISTS 'ETA_REPLY';

-- Create pedr_eta_records table (one row per PEDR, upserted on save)
CREATE TABLE IF NOT EXISTS "pedr_eta_records" (
  "id"          TEXT        NOT NULL,
  "pedrId"      UUID        NOT NULL,
  "msgEta"      TIMESTAMPTZ(6),
  "etaNotify"   TIMESTAMPTZ(6),
  "etaNotifyOn" BOOLEAN     NOT NULL DEFAULT false,
  "etpob"       TIMESTAMPTZ(6),
  "etpobOn"     BOOLEAN     NOT NULL DEFAULT false,
  "etb"         TIMESTAMPTZ(6),
  "etbOn"       BOOLEAN     NOT NULL DEFAULT false,
  "refMessage"  TEXT,
  "updatedAt"   TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "pedr_eta_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pedr_eta_records_pedrId_key"
  ON "pedr_eta_records"("pedrId");

ALTER TABLE "pedr_eta_records"
  ADD CONSTRAINT "pedr_eta_records_pedrId_fkey"
  FOREIGN KEY ("pedrId") REFERENCES "pedrs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
