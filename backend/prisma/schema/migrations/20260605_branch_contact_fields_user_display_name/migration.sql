-- Branch: operational contact fields for email signatures
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "email"         VARCHAR(255);
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "address"       TEXT;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "phone"         VARCHAR(100);
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "fax"           VARCHAR(100);
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "mobile24h"     VARCHAR(255);
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "coverage"      TEXT;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "contactName"   VARCHAR(255);
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "contactTitle"  VARCHAR(255);
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "contactMobile" VARCHAR(100);
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "contactEmail"  VARCHAR(255);
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "centralEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- User: display name for email signatures
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "displayName" VARCHAR(255);
