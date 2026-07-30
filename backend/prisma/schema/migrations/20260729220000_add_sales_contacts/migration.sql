-- SalesContact — a master-data directory for the people named on the paper
-- service voucher: CONDUCTOR (driver) and USUARIO (whoever received the
-- service). One flat list feeds both fields; there is no driver/user role split.
--
-- sales.driverName / sales.userName were free text. They become FKs so everyone
-- named on a voucher is registered master data.
--
-- This is a separate migration rather than an edit to
-- 20260729192500_extend_sale_with_voucher_fields, which is already applied —
-- editing an applied migration is what caused the checksum drift that
-- 20260726150000_email_fields_to_arrays left behind.

-- CreateTable
CREATE TABLE "sales_contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "mobile" TEXT,
    "documentNumber" TEXT,
    "vehicle" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sales_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_contacts_name_idx" ON "sales_contacts"("name");

-- AlterTable: the FK columns land alongside the free-text ones so the names can
-- be carried across before anything is dropped.
ALTER TABLE "sales" ADD COLUMN     "driverId" TEXT,
ADD COLUMN     "userId" TEXT;

-- Backfill: register every name already written on a voucher, then repoint the
-- FKs at it. A no-op where driverName/userName were never filled in, but it
-- means the columns' contents are migrated rather than discarded.
--
-- ids are generated cuid-shaped ('c' + 24 hex chars) rather than as UUIDs,
-- because every FK in @portlog/schemas validates with z.string().cuid() — a
-- uuid-shaped id here would fail validation the next time the sale was edited.
INSERT INTO "sales_contacts" ("id", "name", "createdAt", "updatedAt")
SELECT
    'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
    n.name,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT btrim("driverName") AS name
    FROM "sales"
    WHERE "driverName" IS NOT NULL AND btrim("driverName") <> ''
    UNION
    SELECT DISTINCT btrim("userName") AS name
    FROM "sales"
    WHERE "userName" IS NOT NULL AND btrim("userName") <> ''
) AS n;

UPDATE "sales" s
SET "driverId" = c."id"
FROM "sales_contacts" c
WHERE c."name" = btrim(s."driverName");

UPDATE "sales" s
SET "userId" = c."id"
FROM "sales_contacts" c
WHERE c."name" = btrim(s."userName");

-- DropColumn
ALTER TABLE "sales" DROP COLUMN "driverName",
DROP COLUMN "userName";

-- CreateIndex
CREATE INDEX "sales_driverId_idx" ON "sales"("driverId");

-- CreateIndex
CREATE INDEX "sales_userId_idx" ON "sales"("userId");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "sales_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sales_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
