CREATE TYPE "SHDocumentType" AS ENUM ('SH_66A', 'SH_09A', 'SH_28A', 'SH_29A', 'COMMENT', 'OTHER');
CREATE TYPE "SHDocumentStatus" AS ENUM ('DRAFT', 'FINALIZED', 'SENT');

CREATE TABLE "sh_documents" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "nominationId"   UUID NOT NULL,
    "type"           "SHDocumentType" NOT NULL,
    "status"         "SHDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "data"           JSONB NOT NULL DEFAULT '{}',
    "minioKey"       TEXT,
    "pdfGeneratedAt" TIMESTAMPTZ(6),
    "sentAt"         TIMESTAMPTZ(6),
    "title"          TEXT,
    "createdById"    TEXT NOT NULL,
    "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "sh_documents_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "sh_documents" ADD CONSTRAINT "sh_documents_nominationId_fkey"
    FOREIGN KEY ("nominationId") REFERENCES "nominations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sh_documents" ADD CONSTRAINT "sh_documents_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sh_documents" ADD CONSTRAINT "sh_documents_minioKey_key" UNIQUE ("minioKey");

CREATE INDEX "sh_documents_nominationId_type_idx" ON "sh_documents"("nominationId", "type");
CREATE INDEX "sh_documents_nominationId_status_idx" ON "sh_documents"("nominationId", "status");
