CREATE TABLE "email_send_attempts" (
  "id" UUID PRIMARY KEY,
  "requestHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "state" TEXT NOT NULL CHECK ("state" IN ('PREPARING', 'SENDING', 'SENT', 'FAILED', 'UNCERTAIN')),
  "response" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);
