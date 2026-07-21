-- CreateTable
CREATE TABLE "email_attachments" (
    "id" TEXT NOT NULL,
    "minioKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailDispatchId" TEXT,
    "shDocumentDispatchId" TEXT,

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_attachments_minioKey_key" ON "email_attachments"("minioKey");

-- CreateIndex
CREATE INDEX "email_attachments_emailDispatchId_idx" ON "email_attachments"("emailDispatchId");

-- CreateIndex
CREATE INDEX "email_attachments_shDocumentDispatchId_idx" ON "email_attachments"("shDocumentDispatchId");

-- CreateIndex
CREATE INDEX "email_attachments_uploadedById_idx" ON "email_attachments"("uploadedById");

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_emailDispatchId_fkey" FOREIGN KEY ("emailDispatchId") REFERENCES "email_dispatches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_shDocumentDispatchId_fkey" FOREIGN KEY ("shDocumentDispatchId") REFERENCES "sh_document_dispatches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
