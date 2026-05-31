-- Create clients table for port agency client master data.
CREATE TABLE IF NOT EXISTS "clients" (
  "id"              TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "phone"           TEXT,
  "phone2"          TEXT,
  "physicalAddress" TEXT,
  "billingAddress"  TEXT,
  "postalAddress"   TEXT,
  "taxAddress"      TEXT,
  "otherAddress"    TEXT,
  "fax"             TEXT,
  "mobile"          TEXT,
  "email"           TEXT,
  "emailGroup"      TEXT,
  "tariff"          TEXT,
  "instructions"    TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL,

  CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "clients_name_idx" ON "clients"("name");
