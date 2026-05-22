-- Migration: add_pedr_metadata
-- Adds an optional JSON metadata bag to the pedrs table.
-- Used by the ETA stale-alert cron to record { etaStaleAlert, etaLastSent }.

ALTER TABLE "pedrs" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
