-- Sale rows now mirror the paper service voucher (photo supplied 29 Jul 2026):
-- N° DE SERVICIO / A CUENTA DE / PUERTO / SERVICIO RECORRIDO /
-- FECHA + HORA INICIO + HORA FINAL / DESCRIPCION / CONDUCTOR / USUARIO.
-- The voucher's two "Firma" lines are deliberately not modelled.
--
-- "date" and "notes" are RENAMED rather than dropped and re-added, so any rows
-- already captured keep their values. See 20260726150000_email_fields_to_arrays,
-- where a first draft dropped columns on a "this predates production use"
-- assumption that turned out to be wrong.
--
-- "date" becomes "startAt" because it now carries HORA INICIO as well. "endAt"
-- is nullable: a service still under way has no HORA FINAL yet.

-- RenameColumn
ALTER TABLE "sales" RENAME COLUMN "date" TO "startAt";
ALTER TABLE "sales" RENAME COLUMN "notes" TO "description";

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "serviceNo" TEXT,
ADD COLUMN     "route" TEXT,
ADD COLUMN     "portId" TEXT,
ADD COLUMN     "endAt" TIMESTAMPTZ(6),
ADD COLUMN     "driverName" TEXT,
ADD COLUMN     "userName" TEXT;

-- CreateIndex
CREATE INDEX "sales_portId_idx" ON "sales"("portId");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_portId_fkey" FOREIGN KEY ("portId") REFERENCES "ports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
