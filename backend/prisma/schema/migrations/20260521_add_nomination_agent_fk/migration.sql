ALTER TABLE "nominations" ADD COLUMN "agentId" TEXT;

ALTER TABLE "nominations" ADD CONSTRAINT "nominations_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
