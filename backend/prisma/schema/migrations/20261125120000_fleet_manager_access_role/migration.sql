-- Add an explicit access role. No existing user is automatically promoted.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FLT';
