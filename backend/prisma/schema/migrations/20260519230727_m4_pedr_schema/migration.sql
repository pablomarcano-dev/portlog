-- CreateEnum
CREATE TYPE "PedrStage" AS ENUM ('PREARRIBO', 'ATENCION', 'DESPACHO', 'CIERRE');

-- CreateEnum
CREATE TYPE "PedrSubDocumentType" AS ENUM ('ACKNOWLEDGEMENT', 'PREARRIVAL', 'ETA_ETB', 'NOR', 'SOF', 'CARGO_UPDATE');

-- CreateEnum
CREATE TYPE "PedrSubDocumentStatus" AS ENUM ('DRAFT', 'SENT', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PedrEventKind" AS ENUM ('ARRIVED', 'ANCHORED', 'NOR_TENDERED', 'LOADING_START', 'LOADING_END', 'DISCHARGE_START', 'DISCHARGE_END', 'DEPARTED', 'OTHER');

-- CreateTable
CREATE TABLE "pedrs" (
    "id" UUID NOT NULL,
    "nominationId" UUID NOT NULL,
    "currentStage" "PedrStage" NOT NULL DEFAULT 'PREARRIBO',
    "requirements" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pedrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedr_stage_history" (
    "id" UUID NOT NULL,
    "pedrId" UUID NOT NULL,
    "fromStage" "PedrStage",
    "toStage" "PedrStage" NOT NULL,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedr_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedr_sub_documents" (
    "id" UUID NOT NULL,
    "pedrId" UUID NOT NULL,
    "type" "PedrSubDocumentType" NOT NULL,
    "status" "PedrSubDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "stage" "PedrStage" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "recipients" JSONB NOT NULL DEFAULT '[]',
    "body" TEXT,
    "finalizedAt" TIMESTAMPTZ(6),
    "finalizedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pedr_sub_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedr_events" (
    "id" UUID NOT NULL,
    "pedrId" UUID NOT NULL,
    "subDocumentId" UUID,
    "kind" "PedrEventKind" NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedr_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "nominationId" UUID NOT NULL,
    "pedrId" UUID,
    "subDocumentId" UUID,
    "stage" "PedrStage" NOT NULL,
    "docType" TEXT NOT NULL,
    "minioKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pedrs_nominationId_key" ON "pedrs"("nominationId");

-- CreateIndex
CREATE INDEX "pedrs_nominationId_idx" ON "pedrs"("nominationId");

-- CreateIndex
CREATE INDEX "pedrs_currentStage_idx" ON "pedrs"("currentStage");

-- CreateIndex
CREATE INDEX "pedr_stage_history_pedrId_createdAt_idx" ON "pedr_stage_history"("pedrId", "createdAt");

-- CreateIndex
CREATE INDEX "pedr_sub_documents_pedrId_type_idx" ON "pedr_sub_documents"("pedrId", "type");

-- CreateIndex
CREATE INDEX "pedr_events_pedrId_occurredAt_idx" ON "pedr_events"("pedrId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "documents_minioKey_key" ON "documents"("minioKey");

-- CreateIndex
CREATE INDEX "documents_nominationId_createdAt_idx" ON "documents"("nominationId", "createdAt");

-- CreateIndex
CREATE INDEX "documents_pedrId_stage_idx" ON "documents"("pedrId", "stage");

-- AddForeignKey
ALTER TABLE "pedrs" ADD CONSTRAINT "pedrs_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "nominations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedrs" ADD CONSTRAINT "pedrs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedr_stage_history" ADD CONSTRAINT "pedr_stage_history_pedrId_fkey" FOREIGN KEY ("pedrId") REFERENCES "pedrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedr_stage_history" ADD CONSTRAINT "pedr_stage_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedr_sub_documents" ADD CONSTRAINT "pedr_sub_documents_pedrId_fkey" FOREIGN KEY ("pedrId") REFERENCES "pedrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedr_sub_documents" ADD CONSTRAINT "pedr_sub_documents_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedr_sub_documents" ADD CONSTRAINT "pedr_sub_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedr_events" ADD CONSTRAINT "pedr_events_pedrId_fkey" FOREIGN KEY ("pedrId") REFERENCES "pedrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedr_events" ADD CONSTRAINT "pedr_events_subDocumentId_fkey" FOREIGN KEY ("subDocumentId") REFERENCES "pedr_sub_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedr_events" ADD CONSTRAINT "pedr_events_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "nominations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_pedrId_fkey" FOREIGN KEY ("pedrId") REFERENCES "pedrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_subDocumentId_fkey" FOREIGN KEY ("subDocumentId") REFERENCES "pedr_sub_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
