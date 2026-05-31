-- Remove party FK columns from nominations. Replaced by the nomination_clients table.
ALTER TABLE "nominations"
  DROP COLUMN IF EXISTS "operatorId",
  DROP COLUMN IF EXISTS "operatorVariant",
  DROP COLUMN IF EXISTS "operatorContactId",
  DROP COLUMN IF EXISTS "charterId",
  DROP COLUMN IF EXISTS "charterVariant",
  DROP COLUMN IF EXISTS "charterContactId",
  DROP COLUMN IF EXISTS "ownerId",
  DROP COLUMN IF EXISTS "ownerVariant",
  DROP COLUMN IF EXISTS "ownerContactId",
  DROP COLUMN IF EXISTS "shipperId",
  DROP COLUMN IF EXISTS "shipperVariant",
  DROP COLUMN IF EXISTS "shipperContactId",
  DROP COLUMN IF EXISTS "agentId";
