ALTER TABLE "users" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "twoFactorLastSentAt" TIMESTAMP(3);
ALTER TABLE "refresh_tokens" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TYPE "AuditEvent" ADD VALUE 'TWO_FACTOR_ENABLED';
ALTER TYPE "AuditEvent" ADD VALUE 'TWO_FACTOR_DISABLED';
ALTER TYPE "AuditEvent" ADD VALUE 'TWO_FACTOR_FAILURE';
CREATE TABLE "email_two_factor_challenges" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "purpose" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "credentialHash" TEXT NOT NULL,
  "authVersion" INTEGER NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_two_factor_purpose" CHECK ("purpose" IN ('login', 'enable', 'disable'))
);
CREATE INDEX "email_two_factor_challenges_userId_createdAt_idx" ON "email_two_factor_challenges"("userId", "createdAt");
CREATE INDEX "email_two_factor_challenges_expiresAt_idx" ON "email_two_factor_challenges"("expiresAt");
