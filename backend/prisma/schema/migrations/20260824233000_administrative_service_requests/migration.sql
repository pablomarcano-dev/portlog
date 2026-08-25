-- Administrative service requests belong to a branch, not to a vessel.
ALTER TABLE "service_requests"
  ALTER COLUMN "shipParticularId" DROP NOT NULL;
