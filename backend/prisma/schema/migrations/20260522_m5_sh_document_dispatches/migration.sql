CREATE TABLE "sh_document_dispatches" (
    "id"            TEXT NOT NULL,
    "shDocumentId"  UUID NOT NULL,
    "toAddresses"   TEXT[] NOT NULL,
    "ccAddresses"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "subject"       TEXT NOT NULL,
    "bodyHtml"      TEXT,
    "pdfStorageKey" TEXT NOT NULL,
    "sentAt"        TIMESTAMPTZ(6),
    "sentById"      TEXT NOT NULL,
    "error"         TEXT,
    "createdAt"     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "sh_document_dispatches_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "sh_document_dispatches" ADD CONSTRAINT "sh_document_dispatches_shDocumentId_fkey"
    FOREIGN KEY ("shDocumentId") REFERENCES "sh_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sh_document_dispatches" ADD CONSTRAINT "sh_document_dispatches_sentById_fkey"
    FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "sh_document_dispatches_shDocumentId_createdAt_idx"
    ON "sh_document_dispatches"("shDocumentId", "createdAt");
