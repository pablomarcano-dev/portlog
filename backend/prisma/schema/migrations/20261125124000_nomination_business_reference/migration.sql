-- Additive only: existing nominations retain NULL and their original rendering.
-- No counter, historical reference, email subject or document is rewritten.
ALTER TABLE "nominations" ADD COLUMN "businessReference" TEXT;
CREATE UNIQUE INDEX "nominations_businessReference_key" ON "nominations"("businessReference");

CREATE TYPE "NominationOtScope" AS ENUM ('GLOBAL', 'BRANCH');
CREATE TABLE "nomination_numbering_config" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cutoverAt" TIMESTAMPTZ(6) NOT NULL,
  "otScope" "NominationOtScope" NOT NULL,
  "legacyExportSha256" TEXT NOT NULL,
  "legacyExportAsOf" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "nomination_number_series" (
  "kind" "NominationKind" NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "nextValue" INTEGER NOT NULL CHECK ("nextValue" > 0),
  PRIMARY KEY ("kind", "scopeKey")
);
-- No configuration or series are inserted: an absent handover stays inactive.
