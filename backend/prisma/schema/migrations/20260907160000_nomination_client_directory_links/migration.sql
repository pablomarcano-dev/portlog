-- Preserve the directory record selected in each standard Client List row.
-- The existing name remains a historical snapshot and continues to support
-- legacy or manually entered parties that are not in master data.
ALTER TABLE "nomination_clients"
  ADD COLUMN "chartererId" TEXT,
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "operatorId" TEXT;

-- Best-effort backfill for existing standard rows. A deterministic minimum id
-- avoids ambiguous updates if a directory currently contains duplicate names.
UPDATE "nomination_clients" nc
SET "chartererId" = matches."id"
FROM (
  SELECT LOWER(TRIM("name")) AS normalized_name, MIN("id") AS "id"
  FROM "charterers"
  GROUP BY LOWER(TRIM("name"))
) matches
WHERE LOWER(TRIM(nc."name")) = matches.normalized_name
  AND LOWER(TRIM(nc."type")) IN ('charterer', 'charters');

UPDATE "nomination_clients" nc
SET "ownerId" = matches."id"
FROM (
  SELECT LOWER(TRIM("name")) AS normalized_name, MIN("id") AS "id"
  FROM "owners"
  GROUP BY LOWER(TRIM("name"))
) matches
WHERE LOWER(TRIM(nc."name")) = matches.normalized_name
  AND LOWER(TRIM(nc."type")) IN ('disponent owner', 'head owner');

UPDATE "nomination_clients" nc
SET "operatorId" = matches."id"
FROM (
  SELECT LOWER(TRIM("name")) AS normalized_name, MIN("id") AS "id"
  FROM "operators"
  GROUP BY LOWER(TRIM("name"))
) matches
WHERE LOWER(TRIM(nc."name")) = matches.normalized_name
  AND LOWER(TRIM(nc."type")) IN ('commercial operator', 'commercial oper.', 'technical operator');

CREATE INDEX "nomination_clients_chartererId_idx" ON "nomination_clients"("chartererId");
CREATE INDEX "nomination_clients_ownerId_idx" ON "nomination_clients"("ownerId");
CREATE INDEX "nomination_clients_operatorId_idx" ON "nomination_clients"("operatorId");

ALTER TABLE "nomination_clients"
  ADD CONSTRAINT "nomination_clients_chartererId_fkey"
  FOREIGN KEY ("chartererId") REFERENCES "charterers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "nomination_clients_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "nomination_clients_operatorId_fkey"
  FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
