-- CreateTable
CREATE TABLE "sof_timesheets" (
    "id" TEXT NOT NULL,
    "nominationId" UUID NOT NULL,
    "lastPortId" TEXT,
    "nextPortId" TEXT,
    "pierId" TEXT,
    "captain" TEXT,
    "mobileOnBoard" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sof_timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sof_entries" (
    "id" TEXT NOT NULL,
    "sofTimesheetId" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "activityId" TEXT,
    "comment" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sof_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sof_timesheets_nominationId_key" ON "sof_timesheets"("nominationId");

-- CreateIndex
CREATE INDEX "sof_entries_sofTimesheetId_order_idx" ON "sof_entries"("sofTimesheetId", "order");

-- AddForeignKey
ALTER TABLE "sof_timesheets" ADD CONSTRAINT "sof_timesheets_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "nominations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sof_timesheets" ADD CONSTRAINT "sof_timesheets_lastPortId_fkey" FOREIGN KEY ("lastPortId") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sof_timesheets" ADD CONSTRAINT "sof_timesheets_nextPortId_fkey" FOREIGN KEY ("nextPortId") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sof_timesheets" ADD CONSTRAINT "sof_timesheets_pierId_fkey" FOREIGN KEY ("pierId") REFERENCES "piers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sof_entries" ADD CONSTRAINT "sof_entries_sofTimesheetId_fkey" FOREIGN KEY ("sofTimesheetId") REFERENCES "sof_timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sof_entries" ADD CONSTRAINT "sof_entries_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
