ALTER TABLE "service_requests"
  ADD COLUMN "originPoint" TEXT,
  ADD COLUMN "destinationPoint" TEXT,
  ADD COLUMN "contactPersonName" TEXT,
  ADD COLUMN "operationDescription" TEXT,
  ADD COLUMN "reconciliationNotes" TEXT,
  ADD COLUMN "issuedDocxKey" TEXT,
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMPTZ(6),
  ADD COLUMN "issuedById" TEXT,
  ADD COLUMN "issuedAt" TIMESTAMPTZ(6),
  ADD COLUMN "receiptName" TEXT,
  ADD COLUMN "receiptTitle" TEXT,
  ADD COLUMN "receivedAt" TIMESTAMPTZ(6),
  ADD COLUMN "receiptRecordedById" TEXT,
  ADD COLUMN "receiptRecordedAt" TIMESTAMPTZ(6),
  ADD COLUMN "receiptAttachmentId" TEXT;
ALTER TABLE "service_request_dispatches" ADD COLUMN "docxStorageKey" TEXT;

CREATE UNIQUE INDEX "service_requests_issuedDocxKey_key" ON "service_requests"("issuedDocxKey");
CREATE UNIQUE INDEX "service_requests_receiptAttachmentId_key" ON "service_requests"("receiptAttachmentId");
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_receiptRecordedById_fkey" FOREIGN KEY ("receiptRecordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_receiptAttachmentId_fkey" FOREIGN KEY ("receiptAttachmentId") REFERENCES "email_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
