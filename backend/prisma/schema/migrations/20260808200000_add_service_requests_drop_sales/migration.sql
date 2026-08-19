-- ---------------------------------------------------------------------------
-- Service Requests — the horizontal sales / procurement module
-- ---------------------------------------------------------------------------
-- ⚠️ DESTRUCTIVE: this migration DROPs the `sales` table.
--
-- `sales` was the nomination-scoped service voucher (plan 04). It is superseded
-- by `service_requests`, which anchors on a vessel instead of a port call. The
-- user chose an outright drop over a data migration on 2026-08-08 — the captured
-- rows were not worth carrying forward. There is no down-migration; restore from
-- backup if this is applied by mistake.
--
-- Also lands:
--   - `users.branchId`  — the default Sucursal that pre-fills request forms
--   - `email_attachments.serviceRequestId` / `.serviceRequestDispatchId`
--     — reuse of the MinIO attachment plumbing for `Carga de Autorización`
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "ServiceRequestType" AS ENUM ('LAUNCH', 'UNDERWATER_INSPECTION', 'BALLAST_WATER', 'TUG', 'STS', 'GENERAL');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('DRAFT', 'SENT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceLocation" AS ENUM ('ANCHORAGE', 'BERTH', 'BUOY', 'PILOT_STATION', 'OIL_TERMINAL', 'OTHER');

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_clientId_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_driverId_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_nominationId_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_portId_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_userId_fkey";

-- AlterTable
ALTER TABLE "email_attachments" ADD COLUMN     "serviceRequestDispatchId" TEXT,
ADD COLUMN     "serviceRequestId" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "branchId" TEXT;

-- DropTable
DROP TABLE "sales";

-- CreateTable
CREATE TABLE "service_requests" (
    "id" UUID NOT NULL,
    "correlative" SERIAL NOT NULL,
    "type" "ServiceRequestType" NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "shipParticularId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "nominationId" UUID,
    "supplierId" TEXT,
    "providerEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" "ServiceLocation",
    "portId" TEXT,
    "pierId" TEXT,
    "scheduledAt" TIMESTAMPTZ(6) NOT NULL,
    "completedAt" TIMESTAMPTZ(6),
    "physicalVoucherNo" TEXT,
    "notes" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "billToClientId" TEXT,
    "estimatedCost" DECIMAL(12,2),
    "actualCost" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'VES',
    "minioKey" TEXT,
    "pdfGeneratedAt" TIMESTAMPTZ(6),
    "sentAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "cancelReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request_dispatches" (
    "id" TEXT NOT NULL,
    "serviceRequestId" UUID NOT NULL,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "pdfStorageKey" TEXT NOT NULL,
    "sentAt" TIMESTAMPTZ(6),
    "sentById" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_correlative_key" ON "service_requests"("correlative");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_minioKey_key" ON "service_requests"("minioKey");

-- CreateIndex
CREATE INDEX "service_requests_shipParticularId_scheduledAt_idx" ON "service_requests"("shipParticularId", "scheduledAt");

-- CreateIndex
CREATE INDEX "service_requests_branchId_status_idx" ON "service_requests"("branchId", "status");

-- CreateIndex
CREATE INDEX "service_requests_nominationId_idx" ON "service_requests"("nominationId");

-- CreateIndex
CREATE INDEX "service_requests_supplierId_idx" ON "service_requests"("supplierId");

-- CreateIndex
CREATE INDEX "service_requests_status_scheduledAt_idx" ON "service_requests"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "service_requests_type_status_idx" ON "service_requests"("type", "status");

-- CreateIndex
CREATE INDEX "service_request_dispatches_serviceRequestId_createdAt_idx" ON "service_request_dispatches"("serviceRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "email_attachments_serviceRequestDispatchId_idx" ON "email_attachments"("serviceRequestDispatchId");

-- CreateIndex
CREATE INDEX "email_attachments_serviceRequestId_idx" ON "email_attachments"("serviceRequestId");

-- CreateIndex
CREATE INDEX "users_branchId_idx" ON "users"("branchId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_serviceRequestDispatchId_fkey" FOREIGN KEY ("serviceRequestDispatchId") REFERENCES "service_request_dispatches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_shipParticularId_fkey" FOREIGN KEY ("shipParticularId") REFERENCES "ship_particulars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "nominations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_portId_fkey" FOREIGN KEY ("portId") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_pierId_fkey" FOREIGN KEY ("pierId") REFERENCES "piers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_billToClientId_fkey" FOREIGN KEY ("billToClientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_dispatches" ADD CONSTRAINT "service_request_dispatches_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_dispatches" ADD CONSTRAINT "service_request_dispatches_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
