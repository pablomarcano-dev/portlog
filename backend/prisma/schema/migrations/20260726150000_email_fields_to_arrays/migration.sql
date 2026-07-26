-- Multi-address email fields (POR / "nuevo sysportlog.pdf", 22 Jul 2026).
--
-- Every email field that used to hold a single address becomes a text[] so the UI can present
-- it as chips. No backfill: this predates production use, per the maintainer's call on
-- 26 Jul 2026. The existing single-address values are dropped with their columns.
--
-- suppliers.emails was already plural but was a free-text blob; it is converted the same way.

-- shippers
ALTER TABLE "shippers" DROP COLUMN "email";
ALTER TABLE "shippers" ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- operators
ALTER TABLE "operators" DROP COLUMN "email";
ALTER TABLE "operators" ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- contacts
ALTER TABLE "contacts" DROP COLUMN "email";
ALTER TABLE "contacts" ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ship_particulars
ALTER TABLE "ship_particulars" DROP COLUMN "email";
ALTER TABLE "ship_particulars" ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- clients
ALTER TABLE "clients" DROP COLUMN "email";
ALTER TABLE "clients" ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- suppliers (was TEXT holding a free-form list)
ALTER TABLE "suppliers" DROP COLUMN "emails";
ALTER TABLE "suppliers" ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- branches: both the operational address and the contact address become lists.
-- These feed the agent_email / contact_email template variables.
ALTER TABLE "branches" DROP COLUMN "email";
ALTER TABLE "branches" ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "branches" DROP COLUMN "contactEmail";
ALTER TABLE "branches" ADD COLUMN "contactEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
