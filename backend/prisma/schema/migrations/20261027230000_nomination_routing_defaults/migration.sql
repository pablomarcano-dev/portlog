-- Additive and nullable: existing nominations keep all previous saved routing assignments.
ALTER TABLE "nominations" ADD COLUMN "masterContactId" TEXT;
ALTER TABLE "nominations" ADD COLUMN "firstMessageGroupId" TEXT;
ALTER TABLE "nominations" ADD COLUMN "secondMessageGroupId" TEXT;
ALTER TABLE "nominations" ADD COLUMN "thirdMessageGroupId" TEXT;
ALTER TABLE "nominations" ADD COLUMN "alwaysCopyGroupId" TEXT;
CREATE INDEX "nominations_masterContactId_idx" ON "nominations"("masterContactId");
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_masterContactId_fkey" FOREIGN KEY ("masterContactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "nominations_firstMessageGroupId_idx" ON "nominations"("firstMessageGroupId");
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_firstMessageGroupId_fkey" FOREIGN KEY ("firstMessageGroupId") REFERENCES "email_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "nominations_secondMessageGroupId_idx" ON "nominations"("secondMessageGroupId");
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_secondMessageGroupId_fkey" FOREIGN KEY ("secondMessageGroupId") REFERENCES "email_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "nominations_thirdMessageGroupId_idx" ON "nominations"("thirdMessageGroupId");
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_thirdMessageGroupId_fkey" FOREIGN KEY ("thirdMessageGroupId") REFERENCES "email_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "nominations_alwaysCopyGroupId_idx" ON "nominations"("alwaysCopyGroupId");
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_alwaysCopyGroupId_fkey" FOREIGN KEY ("alwaysCopyGroupId") REFERENCES "email_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
