ALTER TABLE "agents"
ADD COLUMN "mobile" TEXT,
ADD COLUMN "branchId" TEXT,
ADD COLUMN "operationalRole" "UserOperationalRole";

CREATE INDEX "agents_branchId_idx" ON "agents"("branchId");
CREATE INDEX "agents_operationalRole_idx" ON "agents"("operationalRole");

ALTER TABLE "agents"
ADD CONSTRAINT "agents_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
