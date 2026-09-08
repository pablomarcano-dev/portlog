ALTER TABLE "nominations"
ADD COLUMN "chartererId" TEXT,
ADD COLUMN "sdwt" DECIMAL(12,3),
ADD COLUMN "grt" DECIMAL(12,3),
ADD COLUMN "loa" DECIMAL(10,3);

CREATE INDEX "nominations_chartererId_idx" ON "nominations"("chartererId");

ALTER TABLE "nominations"
ADD CONSTRAINT "nominations_chartererId_fkey"
FOREIGN KEY ("chartererId") REFERENCES "charterers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
