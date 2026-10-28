ALTER TABLE "email_attachments" ADD COLUMN "terminalPortId" TEXT, ADD COLUMN "terminalRetiredAt" TIMESTAMPTZ;
CREATE INDEX "email_attachments_terminalPortId_idx" ON "email_attachments"("terminalPortId");
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_terminalPortId_fkey" FOREIGN KEY ("terminalPortId") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
