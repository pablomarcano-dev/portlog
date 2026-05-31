-- Add email recipient arrays to nominations table.
-- These are populated at nomination creation and used by all email sends in the nomination flow.
ALTER TABLE "nominations"
  ADD COLUMN IF NOT EXISTS "emailTo"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "emailCc"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "emailBcc" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
