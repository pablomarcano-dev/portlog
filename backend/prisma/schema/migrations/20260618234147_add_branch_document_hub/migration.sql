-- CreateEnum
CREATE TYPE "BranchDocumentFieldType" AS ENUM ('TEXT', 'DATE', 'DATETIME', 'NUMBER', 'TEXTAREA', 'SELECT');

-- CreateEnum
CREATE TYPE "BranchDocumentStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "branch_document_templates" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "hbsTemplate" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "branch_document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_document_template_fields" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "BranchDocumentFieldType" NOT NULL DEFAULT 'TEXT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sourceField" TEXT,
    "placeholder" TEXT,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "branch_document_template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_document_instances" (
    "id" UUID NOT NULL,
    "templateId" TEXT NOT NULL,
    "nominationId" UUID NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" "BranchDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "minioKey" TEXT,
    "pdfGeneratedAt" TIMESTAMPTZ(6),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "branch_document_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_document_templates_branchId_idx" ON "branch_document_templates"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_document_templates_branchId_code_key" ON "branch_document_templates"("branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "branch_document_template_fields_templateId_key_key" ON "branch_document_template_fields"("templateId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "branch_document_instances_minioKey_key" ON "branch_document_instances"("minioKey");

-- CreateIndex
CREATE INDEX "branch_document_instances_nominationId_idx" ON "branch_document_instances"("nominationId");

-- CreateIndex
CREATE INDEX "branch_document_instances_templateId_idx" ON "branch_document_instances"("templateId");

-- AddForeignKey
ALTER TABLE "branch_document_templates" ADD CONSTRAINT "branch_document_templates_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_document_template_fields" ADD CONSTRAINT "branch_document_template_fields_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "branch_document_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_document_instances" ADD CONSTRAINT "branch_document_instances_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "branch_document_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_document_instances" ADD CONSTRAINT "branch_document_instances_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "nominations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_document_instances" ADD CONSTRAINT "branch_document_instances_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
