-- "ETA — Send to Terminal" goes to the terminal and the shipper, not to the
-- nomination's client list. Neither address could be resolved before this:
--
--   * ports had no address list at all. `emailGroup` is a free-text label
--     ("rotterdam-ops") that names no addresses, so it is left untouched.
--   * the CLIENT LIST's Shipper row stored only a typed name, with no link to
--     the shippers directory that holds the addresses.

-- AlterTable: the terminal's own distribution list.
ALTER TABLE "ports" ADD COLUMN     "emails" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: link a CLIENT LIST row to the shipper it names.
ALTER TABLE "nomination_clients" ADD COLUMN     "shipperId" TEXT;

-- Backfill: rows already typed with a name that matches a registered shipper
-- get linked, so existing nominations resolve addresses without being re-edited.
-- Case- and whitespace-insensitive, and skipped where the name is ambiguous —
-- a wrong link here would silently mail a notice to the wrong company.
UPDATE "nomination_clients" nc
SET "shipperId" = s."id"
FROM "shippers" s
WHERE lower(btrim(nc."type")) = 'shipper'
  AND lower(btrim(nc."name")) = lower(btrim(s."name"))
  AND btrim(nc."name") <> ''
  AND (
    SELECT count(*) FROM "shippers" s2
    WHERE lower(btrim(s2."name")) = lower(btrim(nc."name"))
  ) = 1;

-- CreateIndex
CREATE INDEX "nomination_clients_shipperId_idx" ON "nomination_clients"("shipperId");

-- AddForeignKey: SetNull rather than Restrict — deleting a shipper from master
-- data must not be blocked by, or cascade into, a historical nomination. The
-- row keeps its typed name and simply loses the address lookup.
ALTER TABLE "nomination_clients" ADD CONSTRAINT "nomination_clients_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "shippers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
