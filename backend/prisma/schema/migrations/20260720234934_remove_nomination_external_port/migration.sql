-- Remove the External Port field from nominations (dropped from the UI + domain).
ALTER TABLE "nominations" DROP CONSTRAINT IF EXISTS "nominations_externalPortId_fkey";
ALTER TABLE "nominations" DROP COLUMN IF EXISTS "externalPortId";
