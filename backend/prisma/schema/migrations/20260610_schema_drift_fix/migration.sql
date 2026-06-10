-- Drop outdated foreign keys
ALTER TABLE "email_dispatches" DROP CONSTRAINT IF EXISTS "email_dispatches_pedr_fk";
ALTER TABLE "email_dispatches" DROP CONSTRAINT IF EXISTS "email_dispatches_user_fk";
ALTER TABLE "nominations" DROP CONSTRAINT IF EXISTS "nominations_berthPortId_fkey";
ALTER TABLE "nominations" DROP CONSTRAINT IF EXISTS "nominations_pierId_fkey";
ALTER TABLE "ports" DROP CONSTRAINT IF EXISTS "ports_parentId_fkey";

-- Fix branches column types
ALTER TABLE "branches"
    ALTER COLUMN "email" SET DATA TYPE TEXT,
    ALTER COLUMN "phone" SET DATA TYPE TEXT,
    ALTER COLUMN "fax" SET DATA TYPE TEXT,
    ALTER COLUMN "mobile24h" SET DATA TYPE TEXT,
    ALTER COLUMN "contactName" SET DATA TYPE TEXT,
    ALTER COLUMN "contactTitle" SET DATA TYPE TEXT,
    ALTER COLUMN "contactMobile" SET DATA TYPE TEXT,
    ALTER COLUMN "contactEmail" SET DATA TYPE TEXT;

-- Fix nomination_clients id default
ALTER TABLE "nomination_clients" ALTER COLUMN "id" DROP DEFAULT;

-- Fix nominations columns
ALTER TABLE "nominations" DROP COLUMN IF EXISTS "berthPortId";

-- Drop obsolete ports columns
ALTER TABLE "ports" DROP COLUMN IF EXISTS "location";
ALTER TABLE "ports" DROP COLUMN IF EXISTS "parentId";

-- Fix sh_documents
ALTER TABLE "sh_documents" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "sh_documents" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Fix users column types
ALTER TABLE "users"
    ALTER COLUMN "displayName" SET DATA TYPE TEXT,
    ALTER COLUMN "phone" SET DATA TYPE TEXT,
    ALTER COLUMN "mobile" SET DATA TYPE TEXT,
    ALTER COLUMN "fax" SET DATA TYPE TEXT;

-- Add piers index
CREATE INDEX IF NOT EXISTS "piers_portId_idx" ON "piers"("portId");

-- Fix email_dispatches foreign keys
ALTER TABLE "email_dispatches" ADD CONSTRAINT "email_dispatches_pedrId_fkey"
    FOREIGN KEY ("pedrId") REFERENCES "pedrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_dispatches" ADD CONSTRAINT "email_dispatches_sentById_fkey"
    FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restore nominations pierId FK
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_pierId_fkey"
    FOREIGN KEY ("pierId") REFERENCES "piers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rename indexes
ALTER INDEX IF EXISTS "email_dispatches_pedr_type_idx" RENAME TO "email_dispatches_pedrId_subDocType_idx";
ALTER INDEX IF EXISTS "owners_nombre_idx" RENAME TO "owners_name_idx";
