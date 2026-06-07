-- Rename features → parcels on nominations table
ALTER TABLE "nominations" RENAME COLUMN "features" TO "parcels";
