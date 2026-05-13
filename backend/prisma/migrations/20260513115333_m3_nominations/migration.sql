-- Correlative sequence — atomic SN/OT number generation (must precede table creation)
CREATE SEQUENCE IF NOT EXISTS nomination_correlative_seq START 1 INCREMENT 1;

-- CreateEnum
CREATE TYPE "NominationStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NominationType" AS ENUM ('FULL_AGENCY', 'OWNERS_AGENTS_ONLY', 'CHARTERERS_AGENTS_ONLY');

-- CreateTable
CREATE TABLE "nominations" (
    "id" UUID NOT NULL,
    "correlative" INTEGER NOT NULL DEFAULT nextval('nomination_correlative_seq'),
    "voyageNumber" TEXT NOT NULL,
    "voyageCode" TEXT,
    "shipParticularId" TEXT NOT NULL,
    "operatorId" TEXT,
    "operatorVariant" TEXT,
    "operatorContactId" TEXT,
    "charterId" TEXT,
    "charterVariant" TEXT,
    "charterContactId" TEXT,
    "ownerId" TEXT,
    "ownerVariant" TEXT,
    "ownerContactId" TEXT,
    "shipperId" TEXT,
    "shipperVariant" TEXT,
    "shipperContactId" TEXT,
    "contactBlackBerry" TEXT,
    "blindCopy" TEXT,
    "opPortId" TEXT,
    "berthPortId" TEXT,
    "lastPortId" TEXT,
    "nextPortId" TEXT,
    "disPortId" TEXT,
    "dateNominated" TIMESTAMPTZ(6) NOT NULL,
    "layDaysFirst" TIMESTAMPTZ(6),
    "layDaysLast" TIMESTAMPTZ(6),
    "etaDate" TIMESTAMPTZ(6),
    "nominatedById" TEXT,
    "master" TEXT,
    "mic" TEXT,
    "broker" TEXT,
    "boardingClerk" TEXT,
    "inspector" TEXT,
    "nominationType" "NominationType" NOT NULL DEFAULT 'FULL_AGENCY',
    "subject" TEXT,
    "features" JSONB NOT NULL DEFAULT '[]',
    "status" "NominationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "nominations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nomination_status_history" (
    "id" UUID NOT NULL,
    "nominationId" UUID NOT NULL,
    "fromStatus" "NominationStatus",
    "toStatus" "NominationStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nomination_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nominations_correlative_key" ON "nominations"("correlative");

-- CreateIndex
CREATE INDEX "nominations_status_idx" ON "nominations"("status");

-- CreateIndex
CREATE INDEX "nominations_shipParticularId_idx" ON "nominations"("shipParticularId");

-- CreateIndex
CREATE INDEX "nominations_dateNominated_idx" ON "nominations"("dateNominated");

-- CreateIndex
CREATE INDEX "nomination_status_history_nominationId_createdAt_idx" ON "nomination_status_history"("nominationId", "createdAt");

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_shipParticularId_fkey" FOREIGN KEY ("shipParticularId") REFERENCES "ship_particulars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_charterId_fkey" FOREIGN KEY ("charterId") REFERENCES "charterers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "shippers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_opPortId_fkey" FOREIGN KEY ("opPortId") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_berthPortId_fkey" FOREIGN KEY ("berthPortId") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_lastPortId_fkey" FOREIGN KEY ("lastPortId") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_nextPortId_fkey" FOREIGN KEY ("nextPortId") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_disPortId_fkey" FOREIGN KEY ("disPortId") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_nominatedById_fkey" FOREIGN KEY ("nominatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nomination_status_history" ADD CONSTRAINT "nomination_status_history_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "nominations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nomination_status_history" ADD CONSTRAINT "nomination_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraint: reason must be non-null when cancelling (legally required for audit trail)
ALTER TABLE nomination_status_history
  ADD CONSTRAINT nomination_status_history_cancel_reason_chk
  CHECK ("toStatus" <> 'CANCELLED' OR "reason" IS NOT NULL);
