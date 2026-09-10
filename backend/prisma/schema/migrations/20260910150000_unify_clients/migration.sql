-- This is a reset/reseed change, not a backfill. Refuse a populated company
-- directory before changing any tables; capture live catalogs and use the
-- guarded db:reset:catalogs command instead of an in-place deployment.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM clients) OR EXISTS (SELECT 1 FROM charterers)
    OR EXISTS (SELECT 1 FROM shippers) OR EXISTS (SELECT 1 FROM operators)
    OR EXISTS (SELECT 1 FROM contacts) THEN
    RAISE EXCEPTION 'Client consolidation requires a reset: capture Activities and Cargoes, then run db:reset:catalogs with writers stopped';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "ClientEntityType" AS ENUM ('CLIENT', 'CHARTERER', 'SHIPPER', 'OPERATOR');

-- CreateEnum
CREATE TYPE "PhoneKind" AS ENUM ('BUSINESS', 'HOME', 'MOBILE', 'FAX', 'OTHER');

-- CreateEnum
CREATE TYPE "AddressPurpose" AS ENUM ('PHYSICAL', 'BILLING', 'POSTAL', 'TAX', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientLocationType" AS ENUM ('LOCAL', 'EXTERIOR');

-- CreateEnum
CREATE TYPE "ClientEmailSlot" AS ENUM ('FIRST_MESSAGE', 'SECOND_MESSAGE', 'THIRD_MESSAGE', 'CC_MESSAGE');

-- DropForeignKey
ALTER TABLE "clients" DROP CONSTRAINT "clients_emailGroupId_fkey";

-- DropForeignKey
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_shipperId_fkey";

-- DropForeignKey
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_operatorId_fkey";

-- DropForeignKey
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_charterId_fkey";

-- DropForeignKey
ALTER TABLE "ship_particulars" DROP CONSTRAINT "ship_particulars_operatorId_fkey";

-- DropForeignKey
ALTER TABLE "nominations" DROP CONSTRAINT "nominations_chartererId_fkey";

-- DropForeignKey
ALTER TABLE "nomination_clients" DROP CONSTRAINT "nomination_clients_chartererId_fkey";

-- DropForeignKey
ALTER TABLE "nomination_clients" DROP CONSTRAINT "nomination_clients_operatorId_fkey";

-- DropForeignKey
ALTER TABLE "nomination_clients" DROP CONSTRAINT "nomination_clients_shipperId_fkey";

-- DropIndex
DROP INDEX "clients_name_idx";

-- DropIndex
DROP INDEX "clients_emailGroupId_idx";

-- DropIndex
DROP INDEX "nomination_clients_chartererId_idx";

-- DropIndex
DROP INDEX "nomination_clients_operatorId_idx";

-- DropIndex
DROP INDEX "nomination_clients_shipperId_idx";

-- AlterTable
ALTER TABLE "clients" DROP COLUMN "billingAddress",
DROP COLUMN "emailGroup",
DROP COLUMN "emailGroupId",
DROP COLUMN "fax",
DROP COLUMN "mobile",
DROP COLUMN "otherAddress",
DROP COLUMN "phone",
DROP COLUMN "phone2",
DROP COLUMN "physicalAddress",
DROP COLUMN "postalAddress",
DROP COLUMN "tariff",
DROP COLUMN "taxAddress",
ADD COLUMN     "entityType" "ClientEntityType" NOT NULL DEFAULT 'CLIENT',
ADD COLUMN     "locationType" "ClientLocationType",
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "contacts" DROP COLUMN "address",
DROP COLUMN "businessFax",
DROP COLUMN "businessPhone",
DROP COLUMN "charterId",
DROP COLUMN "comments",
DROP COLUMN "homePhone",
DROP COLUMN "mobile",
DROP COLUMN "operatorId",
DROP COLUMN "shipperId",
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "nomination_clients" DROP COLUMN "chartererId",
DROP COLUMN "operatorId",
DROP COLUMN "shipperId",
ADD COLUMN     "clientId" TEXT;

-- DropTable
DROP TABLE "charterers";

-- DropTable
DROP TABLE "shippers";

-- DropTable
DROP TABLE "operators";

-- CreateTable
CREATE TABLE "client_phones" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" "PhoneKind" NOT NULL,
    "number" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "client_phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_addresses" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "purpose" "AddressPurpose" NOT NULL,
    "text" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "client_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_tariff_items" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "amountText" TEXT,
    "information" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "client_tariff_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_email_groups" (
    "clientId" TEXT NOT NULL,
    "slot" "ClientEmailSlot" NOT NULL,
    "emailGroupId" TEXT NOT NULL,

    CONSTRAINT "client_email_groups_pkey" PRIMARY KEY ("clientId","slot")
);

-- CreateTable
CREATE TABLE "contact_phones" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "kind" "PhoneKind" NOT NULL,
    "number" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contact_phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_addresses" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "purpose" "AddressPurpose" NOT NULL,
    "text" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contact_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_phones_clientId_idx" ON "client_phones"("clientId");

-- CreateIndex
CREATE INDEX "client_addresses_clientId_idx" ON "client_addresses"("clientId");

-- CreateIndex
CREATE INDEX "client_tariff_items_clientId_idx" ON "client_tariff_items"("clientId");

-- CreateIndex
CREATE INDEX "client_email_groups_emailGroupId_idx" ON "client_email_groups"("emailGroupId");

-- CreateIndex
CREATE INDEX "contact_phones_contactId_idx" ON "contact_phones"("contactId");

-- CreateIndex
CREATE INDEX "contact_addresses_contactId_idx" ON "contact_addresses"("contactId");

-- CreateIndex
CREATE INDEX "clients_name_id_idx" ON "clients"("name", "id");

-- CreateIndex
CREATE INDEX "clients_entityType_idx" ON "clients"("entityType");

-- CreateIndex
CREATE INDEX "contacts_name_id_idx" ON "contacts"("name", "id");

-- CreateIndex
CREATE INDEX "nomination_clients_clientId_idx" ON "nomination_clients"("clientId");

-- AddForeignKey
ALTER TABLE "client_phones" ADD CONSTRAINT "client_phones_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_addresses" ADD CONSTRAINT "client_addresses_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_tariff_items" ADD CONSTRAINT "client_tariff_items_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_email_groups" ADD CONSTRAINT "client_email_groups_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_email_groups" ADD CONSTRAINT "client_email_groups_emailGroupId_fkey" FOREIGN KEY ("emailGroupId") REFERENCES "email_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_phones" ADD CONSTRAINT "contact_phones_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_addresses" ADD CONSTRAINT "contact_addresses_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ship_particulars" ADD CONSTRAINT "ship_particulars_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_chartererId_fkey" FOREIGN KEY ("chartererId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nomination_clients" ADD CONSTRAINT "nomination_clients_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Canonical address purposes are unique; named OTHER entries may repeat only
-- with distinct labels. Prisma does not represent partial indexes/checks.
CREATE UNIQUE INDEX client_addresses_purpose_unique ON client_addresses ("clientId", purpose) WHERE purpose <> 'OTHER';
CREATE UNIQUE INDEX contact_addresses_purpose_unique ON contact_addresses ("contactId", purpose) WHERE purpose <> 'OTHER';
CREATE UNIQUE INDEX client_addresses_other_label_unique ON client_addresses ("clientId", lower(btrim(label))) WHERE purpose = 'OTHER';
CREATE UNIQUE INDEX contact_addresses_other_label_unique ON contact_addresses ("contactId", lower(btrim(label))) WHERE purpose = 'OTHER';
ALTER TABLE client_addresses ADD CONSTRAINT client_addresses_other_label_check CHECK (purpose <> 'OTHER' OR (label IS NOT NULL AND btrim(label) <> ''));
ALTER TABLE contact_addresses ADD CONSTRAINT contact_addresses_other_label_check CHECK (purpose <> 'OTHER' OR (label IS NOT NULL AND btrim(label) <> ''));
ALTER TABLE nomination_clients ADD CONSTRAINT nomination_clients_single_entity_check CHECK ("clientId" IS NULL OR "ownerId" IS NULL);
