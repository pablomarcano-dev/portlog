-- AlterTable
ALTER TABLE "users" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "flags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargoes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bblUnit" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cargoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,
    "location" TEXT,
    "parentId" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charterers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contactInfo" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "charterers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shippers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "businessPhone" TEXT,
    "businessFax" TEXT,
    "address" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shippers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contactInfo" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operators" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "businessPhone" TEXT,
    "businessFax" TEXT,
    "address" TEXT,
    "standardRequirements" TEXT,
    "sendCopy" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "itemsProforma" JSONB,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owners" (
    "id" TEXT NOT NULL,
    "listadoContacto" TEXT,
    "cantidad" INTEGER,
    "numeroContacto" TEXT,
    "nombre" TEXT NOT NULL,
    "direccionFisica" TEXT,
    "telefonos" TEXT,
    "direccion" TEXT,
    "cargo" TEXT,
    "redesSociales" TEXT,
    "comentarios" TEXT,
    "cumpleanos" TEXT,
    "gustos" TEXT,
    "recomendaciones" TEXT,
    "business" TEXT,
    "webpage" TEXT,
    "acuerdos" TEXT,
    "historyJson" JSONB,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactos" TEXT,
    "direccion" TEXT,
    "servicios" TEXT,
    "kyc" TEXT,
    "telefonos" TEXT,
    "correosElectronicos" TEXT,
    "certificados" TEXT,
    "tarifas" TEXT,
    "contratoDeServicios" TEXT,
    "acuerdos" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "homePhone" TEXT,
    "mobile" TEXT,
    "businessPhone" TEXT,
    "businessFax" TEXT,
    "address" TEXT,
    "shipperId" TEXT,
    "operatorId" TEXT,
    "ownerId" TEXT,
    "charterId" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ship_particulars" (
    "id" TEXT NOT NULL,
    "callSign" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,
    "loa" DECIMAL(10,3),
    "dwt" DECIMAL(12,3),
    "grt" DECIMAL(12,3),
    "nrt" DECIMAL(12,3),
    "email" TEXT,
    "imoNumber" TEXT,
    "phone" TEXT,
    "phone2" TEXT,
    "fax" TEXT,
    "flagId" TEXT NOT NULL,
    "ownerId" TEXT,
    "operatorId" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ship_particulars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flags_name_key" ON "flags"("name");

-- CreateIndex
CREATE INDEX "flags_name_idx" ON "flags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "activities_name_key" ON "activities"("name");

-- CreateIndex
CREATE INDEX "ports_name_idx" ON "ports"("name");

-- CreateIndex
CREATE INDEX "charterers_name_idx" ON "charterers"("name");

-- CreateIndex
CREATE INDEX "shippers_name_idx" ON "shippers"("name");

-- CreateIndex
CREATE INDEX "agents_name_idx" ON "agents"("name");

-- CreateIndex
CREATE INDEX "operators_name_idx" ON "operators"("name");

-- CreateIndex
CREATE INDEX "owners_nombre_idx" ON "owners"("nombre");

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ship_particulars_callSign_key" ON "ship_particulars"("callSign");

-- CreateIndex
CREATE UNIQUE INDEX "ship_particulars_imoNumber_key" ON "ship_particulars"("imoNumber");

-- CreateIndex
CREATE INDEX "ship_particulars_name_idx" ON "ship_particulars"("name");

-- CreateIndex
CREATE INDEX "ship_particulars_imoNumber_idx" ON "ship_particulars"("imoNumber");

-- AddForeignKey
ALTER TABLE "ports" ADD CONSTRAINT "ports_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "shippers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_charterId_fkey" FOREIGN KEY ("charterId") REFERENCES "charterers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ship_particulars" ADD CONSTRAINT "ship_particulars_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "flags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ship_particulars" ADD CONSTRAINT "ship_particulars_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ship_particulars" ADD CONSTRAINT "ship_particulars_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Custom CHECK constraint: a Contact row may belong to at most one entity at a time.
-- Prisma cannot express CHECK constraints natively; appended manually per story spec.
ALTER TABLE "contacts"
  ADD CONSTRAINT contacts_single_owner_chk
  CHECK (
    (CASE WHEN "shipperId"  IS NULL THEN 0 ELSE 1 END +
     CASE WHEN "operatorId" IS NULL THEN 0 ELSE 1 END +
     CASE WHEN "ownerId"    IS NULL THEN 0 ELSE 1 END +
     CASE WHEN "charterId"  IS NULL THEN 0 ELSE 1 END) <= 1
  );
