-- Owner: rename Spanish fields to English
ALTER TABLE "owners" RENAME COLUMN "nombre" TO "name";
ALTER TABLE "owners" RENAME COLUMN "listadoContacto" TO "contactList";
ALTER TABLE "owners" RENAME COLUMN "cantidad" TO "quantity";
ALTER TABLE "owners" RENAME COLUMN "numeroContacto" TO "contactNumber";
ALTER TABLE "owners" RENAME COLUMN "direccionFisica" TO "physicalAddress";
ALTER TABLE "owners" RENAME COLUMN "telefonos" TO "phones";
ALTER TABLE "owners" RENAME COLUMN "direccion" TO "address";
ALTER TABLE "owners" RENAME COLUMN "cargo" TO "position";
ALTER TABLE "owners" RENAME COLUMN "redesSociales" TO "socialMedia";
ALTER TABLE "owners" RENAME COLUMN "comentarios" TO "notes";
ALTER TABLE "owners" RENAME COLUMN "cumpleanos" TO "birthday";
ALTER TABLE "owners" RENAME COLUMN "gustos" TO "preferences";
ALTER TABLE "owners" RENAME COLUMN "recomendaciones" TO "recommendations";
ALTER TABLE "owners" RENAME COLUMN "acuerdos" TO "agreements";

-- Supplier: rename Spanish fields to English
ALTER TABLE "suppliers" RENAME COLUMN "contactos" TO "contacts";
ALTER TABLE "suppliers" RENAME COLUMN "direccion" TO "address";
ALTER TABLE "suppliers" RENAME COLUMN "servicios" TO "services";
ALTER TABLE "suppliers" RENAME COLUMN "telefonos" TO "phones";
ALTER TABLE "suppliers" RENAME COLUMN "correosElectronicos" TO "emails";
ALTER TABLE "suppliers" RENAME COLUMN "certificados" TO "certificates";
ALTER TABLE "suppliers" RENAME COLUMN "tarifas" TO "rates";
ALTER TABLE "suppliers" RENAME COLUMN "contratoDeServicios" TO "serviceContract";
ALTER TABLE "suppliers" RENAME COLUMN "acuerdos" TO "agreements";

-- FleetVessel: rename zarpeSince to departureSince
ALTER TABLE "fleet_vessels" RENAME COLUMN "zarpeSince" TO "departureSince";

-- PedrStage enum: rename values
ALTER TYPE "PedrStage" RENAME VALUE 'PREARRIBO' TO 'PRE_ARRIVAL';
ALTER TYPE "PedrStage" RENAME VALUE 'ATENCION' TO 'ATTENDING';
ALTER TYPE "PedrStage" RENAME VALUE 'DESPACHO' TO 'DISPATCH';
ALTER TYPE "PedrStage" RENAME VALUE 'CIERRE' TO 'CLOSING';
