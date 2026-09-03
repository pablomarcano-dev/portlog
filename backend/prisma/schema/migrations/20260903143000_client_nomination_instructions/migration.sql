-- Upgrade Clients from free-text references to reusable master-data links.
ALTER TABLE "clients" ADD COLUMN "emailGroupId" TEXT;

-- Preserve existing setups when the legacy value exactly names an Email Group.
UPDATE "clients" AS c
SET "emailGroupId" = g."id"
FROM "email_groups" AS g
WHERE LOWER(TRIM(c."emailGroup")) = LOWER(TRIM(g."name"));

CREATE INDEX "clients_emailGroupId_idx" ON "clients"("emailGroupId");
ALTER TABLE "clients" ADD CONSTRAINT "clients_emailGroupId_fkey"
  FOREIGN KEY ("emailGroupId") REFERENCES "email_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "client_contacts" (
  "clientId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("clientId", "contactId")
);

CREATE INDEX "client_contacts_contactId_idx" ON "client_contacts"("contactId");
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nomination rows retain their typed name as a snapshot while gaining the real
-- master-data association needed to resolve instructions and recipients.
ALTER TABLE "nomination_clients" ADD COLUMN "clientId" TEXT;
CREATE INDEX "nomination_clients_clientId_idx" ON "nomination_clients"("clientId");
ALTER TABLE "nomination_clients" ADD CONSTRAINT "nomination_clients_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
