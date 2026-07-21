-- CreateEnum
CREATE TYPE "CargoCategory" AS ENUM ('SN', 'OT');

-- CreateEnum
CREATE TYPE "NominationKind" AS ENUM ('SN', 'OT');

-- AlterTable
ALTER TABLE "cargoes" ADD COLUMN     "category" "CargoCategory" NOT NULL DEFAULT 'SN';

-- AlterTable
ALTER TABLE "nominations" ADD COLUMN     "kind" "NominationKind" NOT NULL DEFAULT 'SN';
