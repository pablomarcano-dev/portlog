-- Simplify NominationStatus: DRAFT/CONFIRMED/IN_PROGRESS/COMPLETED collapse to
-- NOMINATED (the operational statuses IN_PORT / FULL_AWAY are now DERIVED at read
-- time and never persisted); CANCELLED is preserved as the manual override.

-- The reason CHECK constraint references a 'CANCELLED' enum literal, which blocks
-- swapping the underlying type; drop it up front and recreate it at the end.
ALTER TABLE "nomination_status_history"
  DROP CONSTRAINT "nomination_status_history_cancel_reason_chk";

-- Recreate the enum type with the new set of values.
ALTER TYPE "NominationStatus" RENAME TO "NominationStatus_old";
CREATE TYPE "NominationStatus" AS ENUM ('NOMINATED', 'IN_PORT', 'FULL_AWAY', 'CANCELLED');

-- nominations.status — drop default, remap data, restore default.
ALTER TABLE "nominations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "nominations" ALTER COLUMN "status" TYPE "NominationStatus"
  USING (
    CASE
      WHEN "status"::text = 'CANCELLED' THEN 'CANCELLED'
      ELSE 'NOMINATED'
    END
  )::"NominationStatus";
ALTER TABLE "nominations" ALTER COLUMN "status" SET DEFAULT 'NOMINATED';

-- nomination_status_history.fromStatus (nullable) — remap, preserving NULL.
ALTER TABLE "nomination_status_history" ALTER COLUMN "fromStatus" TYPE "NominationStatus"
  USING (
    CASE
      WHEN "fromStatus" IS NULL THEN NULL
      WHEN "fromStatus"::text = 'CANCELLED' THEN 'CANCELLED'
      ELSE 'NOMINATED'
    END
  )::"NominationStatus";

-- nomination_status_history.toStatus — remap.
ALTER TABLE "nomination_status_history" ALTER COLUMN "toStatus" TYPE "NominationStatus"
  USING (
    CASE
      WHEN "toStatus"::text = 'CANCELLED' THEN 'CANCELLED'
      ELSE 'NOMINATED'
    END
  )::"NominationStatus";

DROP TYPE "NominationStatus_old";

-- Recreate the reason CHECK constraint against the new enum type.
ALTER TABLE "nomination_status_history"
  ADD CONSTRAINT "nomination_status_history_cancel_reason_chk"
  CHECK ("toStatus" <> 'CANCELLED' OR "reason" IS NOT NULL);
