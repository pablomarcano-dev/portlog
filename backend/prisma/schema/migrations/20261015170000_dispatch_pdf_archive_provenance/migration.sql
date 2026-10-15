-- Preserve historical rows: NULL means PDF presence cannot be established.
-- Do not backfill unknown messages from document type or current templates.
ALTER TABLE "email_dispatches" ADD COLUMN "generatedPdfExpected" BOOLEAN;
