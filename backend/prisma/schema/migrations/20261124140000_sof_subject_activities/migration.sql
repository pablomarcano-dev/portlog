CREATE TABLE "sof_subject_activities" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "eventNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sof_subject_activities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sof_subject_activities_label_key" ON "sof_subject_activities"("label");

INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-01', 'Arrival Times & Conditions', ARRAY[]::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-02', 'Port Authorities / Agent On Board', ARRAY['Agent and port authorities on board']::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-03', 'Clearance by Port Authorities', ARRAY['Cleared By Port Authorities']::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-04', 'Port Authorities Disembark', ARRAY['Port Authorities Disembarked']::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-05', 'Pilot On Board', ARRAY[]::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-06', 'All Fast', ARRAY[]::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-07', 'Key Meeting Details', ARRAY[]::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-08', 'N.O.R. Accepted', ARRAY['Notice of Readiness Accepted']::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-09', 'Commenced Loading', ARRAY[]::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-10', 'Completed Loading', ARRAY[]::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-11', 'Completed Calculation TRV', ARRAY[]::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-12', 'Cargo Documents on Board', ARRAY[]::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-13', 'Anchored Aw. Cargo Documents', ARRAY[]::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-14', 'Anti-Narcotics Team / Divers', ARRAY[]::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-15', 'Anti-Narcotics Team / Divers/ Agent Disembark', ARRAY[]::TEXT[]);
INSERT INTO "sof_subject_activities" ("id", "label", "eventNames") VALUES ('sof-subject-16', 'Sailed Full Away', ARRAY[]::TEXT[]);
