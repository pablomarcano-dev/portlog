-- Migration: nomination_gaps
-- Adds Branch master-data table, five supplementary nullable columns on nominations,
-- FK constraints for branchId and externalPortId, and the nomination_clients table.

-- ---------------------------------------------------------------------------
-- Branch master-data table
-- ---------------------------------------------------------------------------
CREATE TABLE "branches" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "comments" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");
CREATE INDEX "branches_code_idx" ON "branches"("code");

-- ---------------------------------------------------------------------------
-- New nullable columns on nominations
-- ---------------------------------------------------------------------------
ALTER TABLE "nominations" ADD COLUMN "branchId" TEXT;
ALTER TABLE "nominations" ADD COLUMN "nomReply" TIMESTAMPTZ(6);
ALTER TABLE "nominations" ADD COLUMN "externalPortId" TEXT;
ALTER TABLE "nominations" ADD COLUMN "mobileOnBoard" TEXT;
ALTER TABLE "nominations" ADD COLUMN "referenceNo" TEXT;

-- FK constraints
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_externalPortId_fkey"
  FOREIGN KEY ("externalPortId") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- NominationClient table
-- ---------------------------------------------------------------------------
CREATE TABLE "nomination_clients" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "nominationId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "voyageRef" TEXT,
  "referenceNo" TEXT,
  "broker" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "nomination_clients_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "nomination_clients_nominationId_idx" ON "nomination_clients"("nominationId");
ALTER TABLE "nomination_clients" ADD CONSTRAINT "nomination_clients_nominationId_fkey"
  FOREIGN KEY ("nominationId") REFERENCES "nominations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
