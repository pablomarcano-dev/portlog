CREATE TABLE "piers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "piers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "piers" ADD CONSTRAINT "piers_portId_fkey"
    FOREIGN KEY ("portId") REFERENCES "ports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nominations" ADD COLUMN IF NOT EXISTS "pierId" TEXT;

ALTER TABLE "nominations" ADD CONSTRAINT "nominations_pierId_fkey"
    FOREIGN KEY ("pierId") REFERENCES "piers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
