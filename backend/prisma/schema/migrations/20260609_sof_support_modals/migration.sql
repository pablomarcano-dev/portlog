-- Add JSON columns to sof_timesheets for support modal data
ALTER TABLE "sof_timesheets"
  ADD COLUMN IF NOT EXISTS "bunkersData"         JSONB,
  ADD COLUMN IF NOT EXISTS "draftData"           JSONB,
  ADD COLUMN IF NOT EXISTS "sofParcelsData"      JSONB,
  ADD COLUMN IF NOT EXISTS "blFiguresData"       JSONB,
  ADD COLUMN IF NOT EXISTS "shipFiguresData"     JSONB,
  ADD COLUMN IF NOT EXISTS "lettersData"         JSONB,
  ADD COLUMN IF NOT EXISTS "remarksData"         JSONB,
  ADD COLUMN IF NOT EXISTS "slopDischargedData"  JSONB,
  ADD COLUMN IF NOT EXISTS "bunkersReceivedData" JSONB;
