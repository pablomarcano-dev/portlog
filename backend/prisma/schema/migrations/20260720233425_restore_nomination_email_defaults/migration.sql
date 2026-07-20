-- Restore the empty-array default on the nomination email-recipient columns.
-- The default (added in 20260531_nomination_email_recipients) was inadvertently
-- dropped by 20260715180517_add_services_and_sales because the schema lacked an
-- explicit @default([]). Without it, direct inserts (seed) that omit these
-- NOT NULL array columns fail with a P2011 null-constraint violation.
ALTER TABLE "nominations" ALTER COLUMN "emailTo"  SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "nominations" ALTER COLUMN "emailCc"  SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "nominations" ALTER COLUMN "emailBcc" SET DEFAULT ARRAY[]::TEXT[];
