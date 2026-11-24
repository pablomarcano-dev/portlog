-- Preserve legacy voyageNumber and historical records. No inferred backfill.
ALTER TABLE "nominations" ADD COLUMN "vesselVoyageNumber" TEXT;
