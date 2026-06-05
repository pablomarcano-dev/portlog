-- User: personal contact fields for email signatures
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone"  VARCHAR(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mobile" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fax"    VARCHAR(100);
