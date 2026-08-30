-- Branch ownership for ports/terminals
ALTER TABLE "ports" ADD COLUMN "branchId" TEXT;
CREATE INDEX "ports_branchId_idx" ON "ports"("branchId");
ALTER TABLE "ports" ADD CONSTRAINT "ports_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Operational responsibilities are distinct from access roles (OPS/ADM).
CREATE TYPE "UserOperationalRole" AS ENUM ('BRANCH_MANAGER', 'SUPERVISOR', 'SHIPPING_AGENT');
ALTER TABLE "users" ADD COLUMN "operationalRole" "UserOperationalRole";

-- Terminal recipients backed by real users.
CREATE TYPE "TerminalRecipientType" AS ENUM ('TO', 'CC', 'BCC');
CREATE TABLE "terminal_contacts" (
  "id" TEXT NOT NULL,
  "portId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "recipientType" "TerminalRecipientType" NOT NULL DEFAULT 'TO',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "terminal_contacts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "terminal_contacts_portId_userId_key" ON "terminal_contacts"("portId", "userId");
CREATE INDEX "terminal_contacts_userId_idx" ON "terminal_contacts"("userId");
ALTER TABLE "terminal_contacts" ADD CONSTRAINT "terminal_contacts_portId_fkey"
  FOREIGN KEY ("portId") REFERENCES "ports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "terminal_contacts" ADD CONSTRAINT "terminal_contacts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exact message received from the captain and forwarded inside QUOTE/UNQUOTE.
ALTER TABLE "pedr_eta_records" ADD COLUMN "captainMessage" TEXT;

-- Consolidate the confirmed duplicate MALAKA vessel. Prefer the record with an
-- IMO and then the oldest record; move its two direct references before delete.
WITH ranked AS (
  SELECT "id",
         FIRST_VALUE("id") OVER (
           ORDER BY ("imoNumber" IS NOT NULL) DESC, "createdAt" ASC, "id" ASC
         ) AS keeper
  FROM "ship_particulars"
  WHERE UPPER(TRIM("name")) = 'MALAKA'
), duplicates AS (
  SELECT "id", keeper FROM ranked WHERE "id" <> keeper
)
UPDATE "nominations" n
SET "shipParticularId" = d.keeper
FROM duplicates d
WHERE n."shipParticularId" = d."id";

WITH ranked AS (
  SELECT "id",
         FIRST_VALUE("id") OVER (
           ORDER BY ("imoNumber" IS NOT NULL) DESC, "createdAt" ASC, "id" ASC
         ) AS keeper
  FROM "ship_particulars"
  WHERE UPPER(TRIM("name")) = 'MALAKA'
), duplicates AS (
  SELECT "id", keeper FROM ranked WHERE "id" <> keeper
)
UPDATE "service_requests" s
SET "shipParticularId" = d.keeper
FROM duplicates d
WHERE s."shipParticularId" = d."id";

WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           ORDER BY ("imoNumber" IS NOT NULL) DESC, "createdAt" ASC, "id" ASC
         ) AS position
  FROM "ship_particulars"
  WHERE UPPER(TRIM("name")) = 'MALAKA'
)
DELETE FROM "ship_particulars" vessel
USING ranked
WHERE vessel."id" = ranked."id" AND ranked.position > 1;

-- Remove only unmistakable, unreferenced vessel placeholders. Referenced test
-- data is intentionally left for the guarded cleanup command rather than
-- deleting an operational history by name alone.
DELETE FROM "ship_particulars" vessel
WHERE UPPER(TRIM(vessel."name")) IN ('TEST', 'TEST VESSEL')
  AND NOT EXISTS (
    SELECT 1 FROM "nominations" n WHERE n."shipParticularId" = vessel."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "service_requests" s WHERE s."shipParticularId" = vessel."id"
  );
