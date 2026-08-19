ALTER TABLE "sof_timesheets"
  ADD COLUMN "includeBunkersDraftParcel" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "includeBillShipFigures" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "includeLettersRemarks" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "includeSlopBunkers" BOOLEAN NOT NULL DEFAULT true;
