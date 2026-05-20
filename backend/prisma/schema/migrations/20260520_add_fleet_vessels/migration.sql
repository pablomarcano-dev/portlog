CREATE TABLE "fleet_vessels" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portUnlocode" TEXT NOT NULL,
    "imo" TEXT NOT NULL,
    "name" TEXT,
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "zarpeSince" TIMESTAMPTZ,

    CONSTRAINT "fleet_vessels_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fleet_vessels_userId_portUnlocode_imo_key" UNIQUE ("userId", "portUnlocode", "imo")
);

CREATE INDEX "fleet_vessels_userId_portUnlocode_idx" ON "fleet_vessels"("userId", "portUnlocode");

ALTER TABLE "fleet_vessels" ADD CONSTRAINT "fleet_vessels_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
