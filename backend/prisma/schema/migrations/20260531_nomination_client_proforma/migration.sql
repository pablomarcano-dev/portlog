-- Add proforma column to nomination_clients table.
ALTER TABLE "nomination_clients"
  ADD COLUMN IF NOT EXISTS "proforma" TEXT;
