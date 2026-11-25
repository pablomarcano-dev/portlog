-- Titles are descriptive. No access roles or existing account assignments change.
ALTER TYPE "UserOperationalRole" ADD VALUE IF NOT EXISTS 'BRANCH_ADMINISTRATOR';
ALTER TYPE "UserOperationalRole" ADD VALUE IF NOT EXISTS 'FLEET_MANAGER';
ALTER TYPE "UserOperationalRole" ADD VALUE IF NOT EXISTS 'SENIOR_FLEET_MANAGER';
ALTER TYPE "UserOperationalRole" ADD VALUE IF NOT EXISTS 'ADMINISTRATION_MANAGER';
