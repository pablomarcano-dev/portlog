-- A nomination has one commercial Client. The rows in nomination_clients are
-- operational parties (charterer, shipper, operator, etc.) and must stay
-- independent from the Clients master-data directory.
ALTER TABLE "nominations" ADD COLUMN "clientId" TEXT;

-- Preserve any association made through the short-lived row-level workflow.
-- When more than one row was linked, keep the first row in display order.
UPDATE "nominations" AS nomination
SET "clientId" = linked."clientId"
FROM (
  SELECT DISTINCT ON ("nominationId") "nominationId", "clientId"
  FROM "nomination_clients"
  WHERE "clientId" IS NOT NULL
  ORDER BY "nominationId", "sortOrder" ASC, "createdAt" ASC
) AS linked
WHERE nomination."id" = linked."nominationId";

CREATE INDEX "nominations_clientId_idx" ON "nominations"("clientId");

ALTER TABLE "nominations"
ADD CONSTRAINT "nominations_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "clients"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "nomination_clients"
DROP CONSTRAINT "nomination_clients_clientId_fkey";

DROP INDEX "nomination_clients_clientId_idx";

ALTER TABLE "nomination_clients" DROP COLUMN "clientId";
