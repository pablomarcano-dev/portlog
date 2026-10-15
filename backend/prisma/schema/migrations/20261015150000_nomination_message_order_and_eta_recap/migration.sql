-- Additive only: existing nominations retain their current instruction groups.
ALTER TABLE "nomination_clients" ADD COLUMN "messageOrder" INTEGER;
ALTER TABLE "nomination_clients" ADD CONSTRAINT "nomination_clients_message_order_check"
  CHECK ("messageOrder" IS NULL OR "messageOrder" BETWEEN 1 AND 3);

-- Preserve all existing dispatch types and message history.
ALTER TYPE "SubDocType" ADD VALUE 'ETA_RECAP';
