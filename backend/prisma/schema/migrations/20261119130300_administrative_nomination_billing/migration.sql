CREATE TYPE "AdministrativeBillingCategory" AS ENUM ('PORT_COSTS', 'OWNER_EXPENSES', 'TECHNICAL_MANAGEMENT');
CREATE TYPE "AdministrativeBillingAddressPurpose" AS ENUM ('TAX', 'BILLING');

CREATE TABLE "administrative_nomination_billing_recipients" (
    "nominationId" UUID NOT NULL,
    "category" "AdministrativeBillingCategory" NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "addressPurpose" "AdministrativeBillingAddressPurpose" NOT NULL,
    "addressText" TEXT NOT NULL,

    CONSTRAINT "administrative_nomination_billing_recipients_pkey" PRIMARY KEY ("nominationId", "category")
);

ALTER TABLE "administrative_nomination_billing_recipients"
    ADD CONSTRAINT "administrative_nomination_billing_recipients_nominationId_fkey"
    FOREIGN KEY ("nominationId") REFERENCES "nominations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
