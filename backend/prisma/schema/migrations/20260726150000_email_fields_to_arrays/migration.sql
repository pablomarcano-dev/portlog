-- Multi-address email fields (POR / "nuevo sysportlog.pdf", 22 Jul 2026).
--
-- Every email field that used to hold a single address becomes a text[] so the UI can present
-- it as chips.
--
-- Each column is migrated as ADD -> backfill -> DROP so existing addresses survive. An earlier
-- draft dropped the columns outright on the assumption that this predated production use; that
-- assumption was wrong — the deployed database held addresses in all seven tables, including the
-- branch addresses that feed the agent_email / contact_email document template variables.
--
-- Blank-but-not-null values become an empty array rather than ARRAY[''], so the UI never renders
-- an empty chip.

-- shippers
ALTER TABLE "shippers" ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "shippers" SET "emails" = ARRAY["email"] WHERE "email" IS NOT NULL AND btrim("email") <> '';
ALTER TABLE "shippers" DROP COLUMN "email";

-- operators
ALTER TABLE "operators" ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "operators" SET "emails" = ARRAY["email"] WHERE "email" IS NOT NULL AND btrim("email") <> '';
ALTER TABLE "operators" DROP COLUMN "email";

-- contacts
ALTER TABLE "contacts" ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "contacts" SET "emails" = ARRAY["email"] WHERE "email" IS NOT NULL AND btrim("email") <> '';
ALTER TABLE "contacts" DROP COLUMN "email";

-- ship_particulars
ALTER TABLE "ship_particulars" ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "ship_particulars" SET "emails" = ARRAY["email"] WHERE "email" IS NOT NULL AND btrim("email") <> '';
ALTER TABLE "ship_particulars" DROP COLUMN "email";

-- clients
ALTER TABLE "clients" ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "clients" SET "emails" = ARRAY["email"] WHERE "email" IS NOT NULL AND btrim("email") <> '';
ALTER TABLE "clients" DROP COLUMN "email";

-- suppliers: was TEXT holding a free-form list, so split on comma/semicolon/whitespace rather
-- than wrapping the whole blob in a single-element array.
ALTER TABLE "suppliers" ADD COLUMN "emails_arr" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "suppliers" SET "emails_arr" = COALESCE(
  (
    SELECT array_agg(part ORDER BY ord)
    FROM (
      SELECT btrim(part) AS part, ord
      FROM regexp_split_to_table("emails", '[,;[:space:]]+') WITH ORDINALITY AS t(part, ord)
    ) parts
    WHERE part <> ''
  ),
  ARRAY[]::TEXT[]
)
WHERE "emails" IS NOT NULL AND btrim("emails") <> '';
ALTER TABLE "suppliers" DROP COLUMN "emails";
ALTER TABLE "suppliers" RENAME COLUMN "emails_arr" TO "emails";

-- branches: both the operational address and the contact address become lists.
-- These feed the agent_email / contact_email template variables.
ALTER TABLE "branches" ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "branches" SET "emails" = ARRAY["email"] WHERE "email" IS NOT NULL AND btrim("email") <> '';
ALTER TABLE "branches" DROP COLUMN "email";

ALTER TABLE "branches" ADD COLUMN "contactEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "branches" SET "contactEmails" = ARRAY["contactEmail"] WHERE "contactEmail" IS NOT NULL AND btrim("contactEmail") <> '';
ALTER TABLE "branches" DROP COLUMN "contactEmail";
