/* eslint-disable no-console */
import {
  PrismaClient,
  Role,
  NominationType,
  NominationStatus,
  PedrStage,
  PedrEventKind,
  SHDocumentType,
  SHDocumentStatus,
  AuditEvent,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function findOrCreate<T extends { id: string }>(
  findFn: () => Promise<T | null>,
  createFn: () => Promise<T>,
): Promise<T> {
  return (await findFn()) ?? (await createFn());
}

async function main(): Promise<void> {
  // ---------------------------------------------------------------------------
  // Users (10)
  // ---------------------------------------------------------------------------
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@portlog.local' },
    update: { displayName: 'Admin Portlog' },
    create: {
      email: 'admin@portlog.local',
      passwordHash: await bcrypt.hash('portlog_admin_dev', 12),
      role: Role.ADM,
      isActive: true,
      displayName: 'Admin Portlog',
    },
  });
  const opsUser = await prisma.user.upsert({
    where: { email: 'ops@portlog.local' },
    update: {
      displayName: 'Carlos Ferrer',
      phone: '+598 2915 4400',
      mobile: '+598 99 123 456',
      fax: '+598 2915 4401',
    },
    create: {
      email: 'ops@portlog.local',
      passwordHash: await bcrypt.hash('portlog_ops_dev', 10),
      role: Role.OPS,
      isActive: true,
      displayName: 'Carlos Ferrer',
      phone: '+598 2915 4400',
      mobile: '+598 99 123 456',
      fax: '+598 2915 4401',
    },
  });
  const user3 = await prisma.user.upsert({
    where: { email: 'laura.gomez@portlog.local' },
    update: {
      displayName: 'Laura Gómez',
      phone: '+598 2915 4402',
      mobile: '+598 99 234 567',
      fax: '+598 2915 4401',
    },
    create: {
      email: 'laura.gomez@portlog.local',
      passwordHash: await bcrypt.hash('portlog_dev_2026', 10),
      role: Role.OPS,
      isActive: true,
      displayName: 'Laura Gómez',
      phone: '+598 2915 4402',
      mobile: '+598 99 234 567',
      fax: '+598 2915 4401',
    },
  });
  const user4 = await prisma.user.upsert({
    where: { email: 'martin.silva@portlog.local' },
    update: {
      displayName: 'Martín Silva',
      phone: '+598 473 22000',
      mobile: '+598 99 345 678',
      fax: '+598 473 22001',
    },
    create: {
      email: 'martin.silva@portlog.local',
      passwordHash: await bcrypt.hash('portlog_dev_2026', 10),
      role: Role.OPS,
      isActive: true,
      displayName: 'Martín Silva',
      phone: '+598 473 22000',
      mobile: '+598 99 345 678',
      fax: '+598 473 22001',
    },
  });
  await prisma.user.upsert({
    where: { email: 'diego.perez@portlog.local' },
    update: {
      displayName: 'Diego Pérez',
      phone: '+598 473 22002',
      mobile: '+598 99 456 789',
      fax: '+598 473 22001',
    },
    create: {
      email: 'diego.perez@portlog.local',
      passwordHash: await bcrypt.hash('portlog_dev_2026', 10),
      role: Role.OPS,
      isActive: true,
      displayName: 'Diego Pérez',
      phone: '+598 473 22002',
      mobile: '+598 99 456 789',
      fax: '+598 473 22001',
    },
  });
  await prisma.user.upsert({
    where: { email: 'sofia.rodriguez@portlog.local' },
    update: {
      displayName: 'Sofía Rodríguez',
      phone: '+598 2915 4403',
      mobile: '+598 99 567 890',
      fax: '+598 2915 4401',
    },
    create: {
      email: 'sofia.rodriguez@portlog.local',
      passwordHash: await bcrypt.hash('portlog_dev_2026', 10),
      role: Role.ADM,
      isActive: true,
      displayName: 'Sofía Rodríguez',
      phone: '+598 2915 4403',
      mobile: '+598 99 567 890',
      fax: '+598 2915 4401',
    },
  });
  await prisma.user.upsert({
    where: { email: 'andres.fernandez@portlog.local' },
    update: { displayName: 'Andrés Fernández' },
    create: {
      email: 'andres.fernandez@portlog.local',
      passwordHash: await bcrypt.hash('portlog_dev_2026', 10),
      role: Role.OPS,
      isActive: false,
      displayName: 'Andrés Fernández',
    },
  });
  await prisma.user.upsert({
    where: { email: 'valentina.torres@portlog.local' },
    update: {
      displayName: 'Valentina Torres',
      phone: '+598 2915 4404',
      mobile: '+598 99 678 901',
      fax: '+598 2915 4401',
    },
    create: {
      email: 'valentina.torres@portlog.local',
      passwordHash: await bcrypt.hash('portlog_dev_2026', 10),
      role: Role.OPS,
      isActive: true,
      displayName: 'Valentina Torres',
      phone: '+598 2915 4404',
      mobile: '+598 99 678 901',
      fax: '+598 2915 4401',
    },
  });
  await prisma.user.upsert({
    where: { email: 'carlos.mendez@portlog.local' },
    update: {
      displayName: 'Carlos Méndez',
      phone: '+598 2915 4405',
      mobile: '+598 99 789 012',
      fax: '+598 2915 4401',
    },
    create: {
      email: 'carlos.mendez@portlog.local',
      passwordHash: await bcrypt.hash('portlog_dev_2026', 10),
      role: Role.ADM,
      isActive: true,
      displayName: 'Carlos Méndez',
      phone: '+598 2915 4405',
      mobile: '+598 99 789 012',
      fax: '+598 2915 4401',
    },
  });
  await prisma.user.upsert({
    where: { email: 'paula.diaz@portlog.local' },
    update: {
      displayName: 'Paula Díaz',
      phone: '+598 2915 4406',
      mobile: '+598 99 890 123',
      fax: '+598 2915 4401',
    },
    create: {
      email: 'paula.diaz@portlog.local',
      passwordHash: await bcrypt.hash('portlog_dev_2026', 10),
      role: Role.OPS,
      isActive: true,
      displayName: 'Paula Díaz',
      phone: '+598 2915 4406',
      mobile: '+598 99 890 123',
      fax: '+598 2915 4401',
    },
  });
  console.log('Seeded 10 users');

  // ---------------------------------------------------------------------------
  // Flags (10)
  // ---------------------------------------------------------------------------
  const flagData = [
    { name: 'Uruguay', abbreviation: 'UY' },
    { name: 'Panama', abbreviation: 'PA' },
    { name: 'Liberia', abbreviation: 'LR' },
    { name: 'Marshall Islands', abbreviation: 'MH' },
    { name: 'Malta', abbreviation: 'MT' },
    { name: 'Bahamas', abbreviation: 'BS' },
    { name: 'Greece', abbreviation: 'GR' },
    { name: 'Cyprus', abbreviation: 'CY' },
    { name: 'Norway', abbreviation: 'NO' },
    { name: 'Singapore', abbreviation: 'SG' },
  ];
  const flags: Record<string, string> = {};
  for (const f of flagData) {
    const flag = await prisma.flag.upsert({ where: { name: f.name }, update: {}, create: f });
    flags[f.abbreviation] = flag.id;
  }
  console.log('Seeded 10 flags');

  // ---------------------------------------------------------------------------
  // Activities (10)
  // ---------------------------------------------------------------------------
  const activityNames = [
    'Carga General',
    'Descarga General',
    'Bunkering',
    'Reparaciones',
    'Cambio de Tripulación',
    'Inspección',
    'Zarpe',
    'Recalada',
    'Zarpe en Lastre',
    'Avituallamiento',
  ];
  for (const name of activityNames) {
    await prisma.activity.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log('Seeded 10 activities');

  // ---------------------------------------------------------------------------
  // Cargoes (10)
  // ---------------------------------------------------------------------------
  const cargoData = [
    { name: 'Soja', bblUnit: 'MT' },
    { name: 'Trigo', bblUnit: 'MT' },
    { name: 'Maíz', bblUnit: 'MT' },
    { name: 'Celulosa', bblUnit: 'MT' },
    { name: 'Fertilizantes', bblUnit: 'MT' },
    { name: 'Combustible', bblUnit: 'BBL' },
    { name: 'Carga General', bblUnit: 'MT' },
    { name: 'Contenedores', bblUnit: 'TEU' },
    { name: 'Pellets de Madera', bblUnit: 'MT' },
    { name: 'Aceite Vegetal', bblUnit: 'MT' },
  ];
  for (const c of cargoData) {
    await findOrCreate(
      () => prisma.cargo.findFirst({ where: { name: c.name } }),
      () => prisma.cargo.create({ data: c }),
    );
  }
  console.log('Seeded 10 cargoes');

  // ---------------------------------------------------------------------------
  // Ports (10) + Piers
  // ---------------------------------------------------------------------------
  const mvdPort = await findOrCreate(
    () => prisma.port.findFirst({ where: { name: 'Puerto de Montevideo' } }),
    () =>
      prisma.port.create({
        data: {
          name: 'Puerto de Montevideo',
          abbreviation: 'MVD',
          country: 'Uruguay',
          emailGroup: 'mvd-ops',
        },
      }),
  );
  const npPort = await findOrCreate(
    () => prisma.port.findFirst({ where: { name: 'Nueva Palmira' } }),
    () =>
      prisma.port.create({
        data: {
          name: 'Nueva Palmira',
          abbreviation: 'NPA',
          country: 'Uruguay',
          emailGroup: 'npa-ops',
        },
      }),
  );
  await findOrCreate(
    () => prisma.port.findFirst({ where: { name: 'Fray Bentos' } }),
    () =>
      prisma.port.create({
        data: { name: 'Fray Bentos', abbreviation: 'FBT', country: 'Uruguay' },
      }),
  );
  const baPort = await findOrCreate(
    () => prisma.port.findFirst({ where: { name: 'Buenos Aires' } }),
    () =>
      prisma.port.create({
        data: {
          name: 'Buenos Aires',
          abbreviation: 'BUE',
          country: 'Argentina',
          emailGroup: 'bue-ops',
        },
      }),
  );
  const rosarioPort = await findOrCreate(
    () => prisma.port.findFirst({ where: { name: 'Rosario' } }),
    () =>
      prisma.port.create({ data: { name: 'Rosario', abbreviation: 'ROS', country: 'Argentina' } }),
  );
  await findOrCreate(
    () => prisma.port.findFirst({ where: { name: 'San Lorenzo' } }),
    () =>
      prisma.port.create({
        data: { name: 'San Lorenzo', abbreviation: 'SLO', country: 'Argentina' },
      }),
  );
  await findOrCreate(
    () => prisma.port.findFirst({ where: { name: 'Campana' } }),
    () =>
      prisma.port.create({ data: { name: 'Campana', abbreviation: 'CMP', country: 'Argentina' } }),
  );
  const bahiaPort = await findOrCreate(
    () => prisma.port.findFirst({ where: { name: 'Bahía Blanca' } }),
    () =>
      prisma.port.create({
        data: { name: 'Bahía Blanca', abbreviation: 'BBL', country: 'Argentina' },
      }),
  );
  await findOrCreate(
    () => prisma.port.findFirst({ where: { name: 'Santos' } }),
    () => prisma.port.create({ data: { name: 'Santos', abbreviation: 'SSZ', country: 'Brasil' } }),
  );
  await findOrCreate(
    () => prisma.port.findFirst({ where: { name: 'Colonia del Sacramento' } }),
    () =>
      prisma.port.create({
        data: { name: 'Colonia del Sacramento', abbreviation: 'COL', country: 'Uruguay' },
      }),
  );
  console.log('Seeded 10 ports');

  // Piers — add representative piers for the main ports
  async function findOrCreatePier(portId: string, name: string) {
    return findOrCreate(
      () => prisma.pier.findFirst({ where: { portId, name } }),
      () => prisma.pier.create({ data: { name, portId } }),
    );
  }
  const pierMvdC = await findOrCreatePier(mvdPort.id, 'Muelle C');
  const pierMvdD = await findOrCreatePier(mvdPort.id, 'Muelle D');
  const pierMvdTCP = await findOrCreatePier(mvdPort.id, 'Terminal Cuenca del Plata (TCP)');
  const pierMvdGdP = await findOrCreatePier(mvdPort.id, 'Graneleros del Plata');
  const pierNpaMain = await findOrCreatePier(npPort.id, 'Muelle Principal');
  const pierNpaFluv = await findOrCreatePier(npPort.id, 'Terminal Fluvial');
  const pierNpaFisc = await findOrCreatePier(npPort.id, 'Muelle Fiscal');
  await findOrCreatePier(baPort.id, 'Dock Sud');
  await findOrCreatePier(baPort.id, 'Terminal 5 TRP');
  await findOrCreatePier(baPort.id, 'Terminal 6 SGT');
  await findOrCreatePier(rosarioPort.id, 'Muelle Nº1');
  await findOrCreatePier(rosarioPort.id, 'Terminal Rosario Puerto');
  await findOrCreatePier(bahiaPort.id, 'Muelle Ing. White');
  await findOrCreatePier(bahiaPort.id, 'Terminal TGS');
  console.log('Seeded piers');

  // ---------------------------------------------------------------------------
  // Operators (10)
  // ---------------------------------------------------------------------------
  const op1 = await findOrCreate(
    () => prisma.operator.findFirst({ where: { name: 'Granos del Sur S.A.' } }),
    () =>
      prisma.operator.create({
        data: {
          name: 'Granos del Sur S.A.',
          email: 'operaciones@granosdelsur.com.uy',
          businessPhone: '+598 2 900 1234',
          address: 'Av. Italia 2850, Montevideo',
          location: 'L',
          sendCopy: true,
          comments: 'Operador principal de graneles.',
        },
      }),
  );
  const op2 = await findOrCreate(
    () => prisma.operator.findFirst({ where: { name: 'Rioplatense Shipping Co.' } }),
    () =>
      prisma.operator.create({
        data: {
          name: 'Rioplatense Shipping Co.',
          email: 'ops@rioplatense.com',
          businessPhone: '+598 2 711 5678',
          address: 'Rambla 25 de Agosto 490, Montevideo',
          location: 'E',
          sendCopy: false,
        },
      }),
  );
  const op3 = await findOrCreate(
    () => prisma.operator.findFirst({ where: { name: 'Ultramar Agencia Marítima S.A.' } }),
    () =>
      prisma.operator.create({
        data: {
          name: 'Ultramar Agencia Marítima S.A.',
          email: 'ops@ultramar.com.uy',
          businessPhone: '+598 2 916 2200',
          address: 'Juncal 1327, Montevideo',
          location: 'L',
          sendCopy: true,
        },
      }),
  );
  const op4 = await findOrCreate(
    () => prisma.operator.findFirst({ where: { name: 'Sudatlantic Shipping S.A.' } }),
    () =>
      prisma.operator.create({
        data: {
          name: 'Sudatlantic Shipping S.A.',
          email: 'operations@sudatlantic.com',
          businessPhone: '+54 11 4311 7890',
          address: 'Corrientes 456, Buenos Aires',
          location: 'E',
          sendCopy: false,
        },
      }),
  );
  await findOrCreate(
    () => prisma.operator.findFirst({ where: { name: 'Naviera Austral S.R.L.' } }),
    () =>
      prisma.operator.create({
        data: {
          name: 'Naviera Austral S.R.L.',
          email: 'info@navieraustral.com.uy',
          businessPhone: '+598 2 600 4455',
          address: 'Br. Artigas 1680, Montevideo',
          location: 'L',
          sendCopy: true,
        },
      }),
  );
  await findOrCreate(
    () => prisma.operator.findFirst({ where: { name: 'Portimar Operaciones S.A.' } }),
    () =>
      prisma.operator.create({
        data: {
          name: 'Portimar Operaciones S.A.',
          email: 'ops@portimar.com.uy',
          businessPhone: '+598 2 418 3300',
          address: 'Luis A. de Herrera 1248, Montevideo',
          location: 'L',
          sendCopy: false,
        },
      }),
  );
  await findOrCreate(
    () => prisma.operator.findFirst({ where: { name: 'Interocean Shipping Ltd.' } }),
    () =>
      prisma.operator.create({
        data: {
          name: 'Interocean Shipping Ltd.',
          email: 'ops@interocean.com',
          businessPhone: '+44 20 7123 4567',
          address: '30 St Mary Axe, London',
          location: 'E',
          sendCopy: false,
        },
      }),
  );
  await findOrCreate(
    () => prisma.operator.findFirst({ where: { name: 'Delta Marine Operators' } }),
    () =>
      prisma.operator.create({
        data: {
          name: 'Delta Marine Operators',
          email: 'ops@deltamarine.com.ar',
          businessPhone: '+54 341 440 2200',
          address: 'Córdoba 1250, Rosario',
          location: 'E',
          sendCopy: false,
        },
      }),
  );
  await findOrCreate(
    () => prisma.operator.findFirst({ where: { name: 'Pacific Rim Shipping S.A.' } }),
    () =>
      prisma.operator.create({
        data: {
          name: 'Pacific Rim Shipping S.A.',
          email: 'ops@pacificrim.com',
          businessPhone: '+65 6123 4567',
          address: '1 Marina Blvd, Singapore',
          location: 'E',
          sendCopy: false,
        },
      }),
  );
  await findOrCreate(
    () => prisma.operator.findFirst({ where: { name: 'Armadores del Río S.A.' } }),
    () =>
      prisma.operator.create({
        data: {
          name: 'Armadores del Río S.A.',
          email: 'ops@armadoresrio.com.uy',
          businessPhone: '+598 2 915 0011',
          address: 'Ciudadela 1228, Montevideo',
          location: 'L',
          sendCopy: true,
        },
      }),
  );
  console.log('Seeded 10 operators');

  // ---------------------------------------------------------------------------
  // Owners (10)
  // ---------------------------------------------------------------------------
  const owner1 = await findOrCreate(
    () => prisma.owner.findFirst({ where: { name: 'Nordic Bulk Carriers AS' } }),
    () =>
      prisma.owner.create({
        data: {
          name: 'Nordic Bulk Carriers AS',
          physicalAddress: 'Strandveien 50, Oslo, Norway',
          phones: '+47 22 123 456',
          position: 'Armador',
          notes: 'Requiere NOR inmediato al fondear.',
          agreements: 'Tarifa fija USD 4,500 por escala.',
        },
      }),
  );
  const owner2 = await findOrCreate(
    () => prisma.owner.findFirst({ where: { name: 'Patagonia Marine Corp.' } }),
    () =>
      prisma.owner.create({
        data: {
          name: 'Patagonia Marine Corp.',
          physicalAddress: 'Panamax Tower, Panama City',
          phones: '+507 340 9900',
          position: 'Propietario',
          notes: 'Opera principalmente rutas ECSA.',
        },
      }),
  );
  const owner3 = await findOrCreate(
    () => prisma.owner.findFirst({ where: { name: 'Hellas Shipping S.A.' } }),
    () =>
      prisma.owner.create({
        data: {
          name: 'Hellas Shipping S.A.',
          physicalAddress: 'Akti Miaouli 87, Piraeus, Greece',
          phones: '+30 210 429 1234',
          position: 'Armador',
          notes: 'Flota de bulkcarriers medianos. Clientes desde 2020.',
        },
      }),
  );
  const owner4 = await findOrCreate(
    () => prisma.owner.findFirst({ where: { name: 'Liberian Star Holdings LLC' } }),
    () =>
      prisma.owner.create({
        data: {
          name: 'Liberian Star Holdings LLC',
          physicalAddress: '80 Broad St, Monrovia, Liberia',
          phones: '+231 77 101 234',
          position: 'Propietario',
          notes: 'Flota bajo bandera liberiana.',
        },
      }),
  );
  const owner5 = await findOrCreate(
    () => prisma.owner.findFirst({ where: { name: 'Bahamas Maritime Inc.' } }),
    () =>
      prisma.owner.create({
        data: {
          name: 'Bahamas Maritime Inc.',
          physicalAddress: 'Nassau, Bahamas',
          phones: '+1 242 323 5500',
          position: 'Armador',
          notes: 'Especializada en tankers.',
        },
      }),
  );
  await findOrCreate(
    () => prisma.owner.findFirst({ where: { name: 'Valetta Shipping Group' } }),
    () =>
      prisma.owner.create({
        data: {
          name: 'Valetta Shipping Group',
          physicalAddress: 'Triq il-Kbira, Valletta, Malta',
          phones: '+356 2122 3456',
          position: 'Propietario',
        },
      }),
  );
  await findOrCreate(
    () => prisma.owner.findFirst({ where: { name: 'Singapore Ocean Lines Pte Ltd' } }),
    () =>
      prisma.owner.create({
        data: {
          name: 'Singapore Ocean Lines Pte Ltd',
          physicalAddress: '168 Robinson Rd, Singapore',
          phones: '+65 6221 9900',
          position: 'Armador',
          agreements: 'Tarifa fija USD 3,800 por escala.',
        },
      }),
  );
  await findOrCreate(
    () => prisma.owner.findFirst({ where: { name: 'Cyprus Bulk Carriers Ltd' } }),
    () =>
      prisma.owner.create({
        data: {
          name: 'Cyprus Bulk Carriers Ltd',
          physicalAddress: 'Limassol, Cyprus',
          phones: '+357 25 123 456',
          position: 'Propietario',
        },
      }),
  );
  await findOrCreate(
    () => prisma.owner.findFirst({ where: { name: 'Río de la Plata Tankers S.A.' } }),
    () =>
      prisma.owner.create({
        data: {
          name: 'Río de la Plata Tankers S.A.',
          physicalAddress: 'Av. del Libertador 498, Buenos Aires',
          phones: '+54 11 4394 5500',
          position: 'Armador',
          notes: 'Tankers de producto. Clientes históricos.',
        },
      }),
  );
  await findOrCreate(
    () => prisma.owner.findFirst({ where: { name: 'Marshall Islands Bulk S.A.' } }),
    () =>
      prisma.owner.create({
        data: {
          name: 'Marshall Islands Bulk S.A.',
          physicalAddress: 'Majuro, Marshall Islands',
          phones: '+692 625 3206',
          position: 'Propietario',
        },
      }),
  );
  console.log('Seeded 10 owners');

  // ---------------------------------------------------------------------------
  // Charterers (10)
  // ---------------------------------------------------------------------------
  const ch1 = await findOrCreate(
    () => prisma.charterer.findFirst({ where: { name: 'Cargill S.A.' } }),
    () =>
      prisma.charterer.create({
        data: {
          name: 'Cargill S.A.',
          address: 'WTC Torre 3, Montevideo',
          contactInfo: 'chartering@cargill.com.uy | +598 2 628 0000',
        },
      }),
  );
  const ch2 = await findOrCreate(
    () => prisma.charterer.findFirst({ where: { name: 'Bunge Uruguay S.A.' } }),
    () =>
      prisma.charterer.create({
        data: {
          name: 'Bunge Uruguay S.A.',
          address: 'Ruta 1 km 26, Montevideo',
          contactInfo: 'ops@bunge.com.uy | +598 2 2000 3300',
        },
      }),
  );
  const ch3 = await findOrCreate(
    () => prisma.charterer.findFirst({ where: { name: 'Louis Dreyfus Company' } }),
    () =>
      prisma.charterer.create({
        data: {
          name: 'Louis Dreyfus Company',
          address: 'Av. del Libertador 1234, Buenos Aires',
          contactInfo: 'chartering@ldc.com | +54 11 4000 8000',
        },
      }),
  );
  await await findOrCreate(
    () => prisma.charterer.findFirst({ where: { name: 'Viterra Uruguay S.A.' } }),
    () =>
      prisma.charterer.create({
        data: {
          name: 'Viterra Uruguay S.A.',
          address: 'Zabala 1463, Montevideo',
          contactInfo: 'ops@viterra.com.uy | +598 2 915 0022',
        },
      }),
  );
  await await findOrCreate(
    () => prisma.charterer.findFirst({ where: { name: 'Cofco International' } }),
    () =>
      prisma.charterer.create({
        data: {
          name: 'Cofco International',
          address: 'Ruta 9 km 11, Montevideo',
          contactInfo: 'chartering@cofco.com | +598 2 510 3300',
        },
      }),
  );
  await findOrCreate(
    () => prisma.charterer.findFirst({ where: { name: 'ADM Argentina S.A.' } }),
    () =>
      prisma.charterer.create({
        data: {
          name: 'ADM Argentina S.A.',
          address: 'Reconquista 258, Buenos Aires',
          contactInfo: 'ops@adm.com.ar | +54 11 4390 1100',
        },
      }),
  );
  await findOrCreate(
    () => prisma.charterer.findFirst({ where: { name: 'Toepfer Transport GmbH' } }),
    () =>
      prisma.charterer.create({
        data: {
          name: 'Toepfer Transport GmbH',
          address: 'Ballindamm 17, Hamburg',
          contactInfo: 'chartering@toepfer-transport.com | +49 40 3202 0',
        },
      }),
  );
  await findOrCreate(
    () => prisma.charterer.findFirst({ where: { name: 'Glencore Grain Rotterdam BV' } }),
    () =>
      prisma.charterer.create({
        data: {
          name: 'Glencore Grain Rotterdam BV',
          address: 'Rotterdam, Netherlands',
          contactInfo: 'grains@glencore.com | +31 10 400 5555',
        },
      }),
  );
  await findOrCreate(
    () => prisma.charterer.findFirst({ where: { name: 'ANCAP Comercial S.A.' } }),
    () =>
      prisma.charterer.create({
        data: {
          name: 'ANCAP Comercial S.A.',
          address: 'Paysandú s/n, Montevideo',
          contactInfo: 'maritimo@ancap.com.uy | +598 2 1912',
        },
      }),
  );
  await findOrCreate(
    () => prisma.charterer.findFirst({ where: { name: 'UPM Uruguay S.A.' } }),
    () =>
      prisma.charterer.create({
        data: {
          name: 'UPM Uruguay S.A.',
          address: 'Ruta 1 Km 84, Fray Bentos',
          contactInfo: 'logistics@upm.com | +598 4562 0000',
        },
      }),
  );
  console.log('Seeded 10 charterers');

  // ---------------------------------------------------------------------------
  // Shippers (10)
  // ---------------------------------------------------------------------------
  await await findOrCreate(
    () => prisma.shipper.findFirst({ where: { name: 'ADN Exportaciones S.A.' } }),
    () =>
      prisma.shipper.create({
        data: {
          name: 'ADN Exportaciones S.A.',
          email: 'embarques@adn.com.uy',
          businessPhone: '+598 2 410 7700',
          address: 'Zonamerica, Montevideo',
        },
      }),
  );
  await await findOrCreate(
    () => prisma.shipper.findFirst({ where: { name: 'Granel Export S.R.L.' } }),
    () =>
      prisma.shipper.create({
        data: {
          name: 'Granel Export S.R.L.',
          email: 'embarques@granelexport.com.uy',
          businessPhone: '+598 2 300 4455',
          address: 'Av. Millán 4185, Montevideo',
        },
      }),
  );
  await await findOrCreate(
    () => prisma.shipper.findFirst({ where: { name: 'Celulosa Argentina S.A.' } }),
    () =>
      prisma.shipper.create({
        data: {
          name: 'Celulosa Argentina S.A.',
          email: 'embarques@celulosaar.com.ar',
          businessPhone: '+54 11 4326 5500',
          address: 'Tucumán 738, Buenos Aires',
        },
      }),
  );
  await findOrCreate(
    () => prisma.shipper.findFirst({ where: { name: 'Fertilizantes del Río S.A.' } }),
    () =>
      prisma.shipper.create({
        data: {
          name: 'Fertilizantes del Río S.A.',
          email: 'logistica@fertirio.com.uy',
          businessPhone: '+598 2 208 1100',
          address: 'Bulevar Artigas 2018, Montevideo',
        },
      }),
  );
  await findOrCreate(
    () => prisma.shipper.findFirst({ where: { name: 'Exportadora Río Grande S.A.' } }),
    () =>
      prisma.shipper.create({
        data: {
          name: 'Exportadora Río Grande S.A.',
          email: 'ops@riogrande.com.uy',
          businessPhone: '+598 2 400 2200',
          address: 'Dr. Luis Bonavita 1294, Montevideo',
        },
      }),
  );
  await findOrCreate(
    () => prisma.shipper.findFirst({ where: { name: 'SugarPlant Uruguay S.A.' } }),
    () =>
      prisma.shipper.create({
        data: {
          name: 'SugarPlant Uruguay S.A.',
          email: 'embarques@sugarplant.com.uy',
          businessPhone: '+598 2 710 8800',
          address: 'Ruta 5 km 8, Montevideo',
        },
      }),
  );
  await findOrCreate(
    () => prisma.shipper.findFirst({ where: { name: 'Forestal Oriental S.A.' } }),
    () =>
      prisma.shipper.create({
        data: {
          name: 'Forestal Oriental S.A.',
          email: 'logistica@forestaloriental.com.uy',
          businessPhone: '+598 4 773 9900',
          address: 'Paysandú, Uruguay',
        },
      }),
  );
  await findOrCreate(
    () => prisma.shipper.findFirst({ where: { name: 'Agronor Exportaciones S.A.' } }),
    () =>
      prisma.shipper.create({
        data: {
          name: 'Agronor Exportaciones S.A.',
          email: 'embarques@agronor.com.uy',
          businessPhone: '+598 2 619 1234',
          address: 'Av. 8 de Octubre 2801, Montevideo',
        },
      }),
  );
  await findOrCreate(
    () => prisma.shipper.findFirst({ where: { name: 'Petrouruguay S.A.' } }),
    () =>
      prisma.shipper.create({
        data: {
          name: 'Petrouruguay S.A.',
          email: 'tankers@petrouruguay.com.uy',
          businessPhone: '+598 2 915 3300',
          address: 'Rambla 25 de Agosto 400, Montevideo',
        },
      }),
  );
  await findOrCreate(
    () => prisma.shipper.findFirst({ where: { name: 'Ence Energía y Celulosa' } }),
    () =>
      prisma.shipper.create({
        data: {
          name: 'Ence Energía y Celulosa',
          email: 'embarques@ence.es',
          businessPhone: '+34 91 337 9000',
          address: 'Pontevedra, España',
        },
      }),
  );
  console.log('Seeded 10 shippers');

  // ---------------------------------------------------------------------------
  // Agents (10)
  // ---------------------------------------------------------------------------
  await await findOrCreate(
    () => prisma.agent.findFirst({ where: { name: 'Sudamer Agencia Marítima' } }),
    () =>
      prisma.agent.create({
        data: {
          name: 'Sudamer Agencia Marítima',
          address: 'Rambla 25 de Agosto 544, Montevideo',
          contactInfo: 'agencia@sudamer.com.uy | +598 2 916 4400',
        },
      }),
  );
  await await findOrCreate(
    () => prisma.agent.findFirst({ where: { name: 'Wilson Sons Agência Marítima' } }),
    () =>
      prisma.agent.create({
        data: {
          name: 'Wilson Sons Agência Marítima',
          address: 'Av. Nilo Peçanha 50, Rio de Janeiro',
          contactInfo: 'agents@wilsonsons.com.br | +55 21 2126 4000',
        },
      }),
  );
  await await findOrCreate(
    () => prisma.agent.findFirst({ where: { name: 'GAC Uruguay S.A.' } }),
    () =>
      prisma.agent.create({
        data: {
          name: 'GAC Uruguay S.A.',
          address: 'Mercedes 1040, Montevideo',
          contactInfo: 'uruguay@gac.com | +598 2 900 9955',
        },
      }),
  );
  await findOrCreate(
    () => prisma.agent.findFirst({ where: { name: 'Inchcape Shipping Services' } }),
    () =>
      prisma.agent.create({
        data: {
          name: 'Inchcape Shipping Services',
          address: 'Plaza Independencia 811, Montevideo',
          contactInfo: 'mvd@iss-shipping.com | +598 2 915 8800',
        },
      }),
  );
  await findOrCreate(
    () => prisma.agent.findFirst({ where: { name: 'Ultramar Agencia Marítima' } }),
    () =>
      prisma.agent.create({
        data: {
          name: 'Ultramar Agencia Marítima',
          address: 'Juncal 1327 P6, Montevideo',
          contactInfo: 'agencia@ultramar.com.uy | +598 2 916 2255',
        },
      }),
  );
  await findOrCreate(
    () => prisma.agent.findFirst({ where: { name: 'Transmar del Plata S.A.' } }),
    () =>
      prisma.agent.create({
        data: {
          name: 'Transmar del Plata S.A.',
          address: 'Cerrito 461, Montevideo',
          contactInfo: 'ops@transmardelplata.com.uy | +598 2 917 3300',
        },
      }),
  );
  await findOrCreate(
    () => prisma.agent.findFirst({ where: { name: 'Maruba S.C.A.' } }),
    () =>
      prisma.agent.create({
        data: {
          name: 'Maruba S.C.A.',
          address: 'Av. Corrientes 420, Buenos Aires',
          contactInfo: 'agencia@maruba.com.ar | +54 11 4320 5500',
        },
      }),
  );
  await findOrCreate(
    () => prisma.agent.findFirst({ where: { name: 'Nabsa Agencia Marítima' } }),
    () =>
      prisma.agent.create({
        data: {
          name: 'Nabsa Agencia Marítima',
          address: 'Maipú 42, Buenos Aires',
          contactInfo: 'agencia@nabsa.com.ar | +54 11 4343 4400',
        },
      }),
  );
  await findOrCreate(
    () => prisma.agent.findFirst({ where: { name: 'Cargill Ocean Transport' } }),
    () =>
      prisma.agent.create({
        data: {
          name: 'Cargill Ocean Transport',
          address: 'WTC Torre 3, Montevideo',
          contactInfo: 'ocean@cargill.com.uy | +598 2 628 0099',
        },
      }),
  );
  await findOrCreate(
    () => prisma.agent.findFirst({ where: { name: 'Rioplatense Agents Ltd.' } }),
    () =>
      prisma.agent.create({
        data: {
          name: 'Rioplatense Agents Ltd.',
          address: 'Rambla 25 de Agosto 490, Montevideo',
          contactInfo: 'agents@rioplatense.com | +598 2 711 5699',
        },
      }),
  );
  console.log('Seeded 10 agents');

  // ---------------------------------------------------------------------------
  // Suppliers (10)
  // ---------------------------------------------------------------------------
  const suppliersData = [
    {
      name: 'Lanchas del Río S.R.L.',
      services: 'Transporte de tripulación, lanchas de prácticos',
      phones: '+598 99 123 456',
      emails: 'reservas@lanchita.com.uy',
    },
    {
      name: 'Maritax Transporte',
      services: 'Traslados terrestres, taxis portuarios',
      phones: '+598 99 654 321',
      emails: 'operaciones@maritax.com.uy',
    },
    {
      name: 'Vituallas Uruguay S.A.',
      services: 'Provisiones, víveres para buques',
      phones: '+598 2 301 5500',
      emails: 'ventas@vituallas.com.uy',
    },
    {
      name: 'Médica Puerto S.A.',
      services: 'Atención médica a tripulantes, control sanitario',
      phones: '+598 2 916 7700',
      emails: 'medico@medicapuerto.com.uy',
    },
    {
      name: 'Grúas Portuarias S.A.',
      services: 'Servicios de grúas y equipos de izado',
      phones: '+598 2 309 8800',
      emails: 'ops@gruasportuarias.com.uy',
    },
    {
      name: 'Remolcadores del Sur S.A.',
      services: 'Remolque en puerto y rada',
      phones: '+598 2 916 9900',
      emails: 'ops@remolcadores.com.uy',
    },
    {
      name: 'Control Naval S.R.L.',
      services: 'Inspección de carga, calado y estibaje',
      phones: '+598 99 400 500',
      emails: 'inspecciones@controlnaval.com.uy',
    },
    {
      name: 'Aguas y Combustibles S.A.',
      services: 'Suministro de agua dulce y combustible bunker',
      phones: '+598 2 918 1100',
      emails: 'bunker@aguasycombustibles.com.uy',
    },
    {
      name: 'Manlift Platense S.A.',
      services: 'Mantenimiento técnico y reparaciones a bordo',
      phones: '+598 2 305 7700',
      emails: 'taller@manlift.com.uy',
    },
    {
      name: 'InterCargo Uruguay S.A.',
      services: 'Estiba, desestiba y movilización de carga',
      phones: '+598 2 916 0022',
      emails: 'ops@intercargo.com.uy',
    },
  ];
  for (const s of suppliersData) {
    await findOrCreate(
      () => prisma.supplier.findFirst({ where: { name: s.name } }),
      () => prisma.supplier.create({ data: s }),
    );
  }
  console.log('Seeded 10 suppliers');

  // ---------------------------------------------------------------------------
  // Contacts (10)
  // ---------------------------------------------------------------------------
  await findOrCreate(
    () => prisma.contact.findFirst({ where: { name: 'Carlos Fernández', operatorId: op1.id } }),
    () =>
      prisma.contact.create({
        data: {
          name: 'Carlos Fernández',
          email: 'cfernandez@granosdelsur.com.uy',
          mobile: '+598 99 201 301',
          businessPhone: '+598 2 900 1234',
          operatorId: op1.id,
        },
      }),
  );
  await findOrCreate(
    () => prisma.contact.findFirst({ where: { name: 'Lars Eriksen', ownerId: owner1.id } }),
    () =>
      prisma.contact.create({
        data: {
          name: 'Lars Eriksen',
          email: 'leriksen@nordicbulk.no',
          mobile: '+47 97 123 456',
          businessPhone: '+47 22 123 456',
          ownerId: owner1.id,
        },
      }),
  );
  await findOrCreate(
    () => prisma.contact.findFirst({ where: { name: 'Ana Rodríguez', charterId: ch1.id } }),
    () =>
      prisma.contact.create({
        data: {
          name: 'Ana Rodríguez',
          email: 'arodriguez@cargill.com.uy',
          mobile: '+598 99 500 600',
          businessPhone: '+598 2 628 0000',
          charterId: ch1.id,
        },
      }),
  );
  await findOrCreate(
    () => prisma.contact.findFirst({ where: { name: 'Pablo Giménez', operatorId: op2.id } }),
    () =>
      prisma.contact.create({
        data: {
          name: 'Pablo Giménez',
          email: 'pgimenez@rioplatense.com',
          mobile: '+598 99 712 800',
          businessPhone: '+598 2 711 5678',
          operatorId: op2.id,
        },
      }),
  );
  await findOrCreate(
    () => prisma.contact.findFirst({ where: { name: 'Stavros Papadopoulos', ownerId: owner3.id } }),
    () =>
      prisma.contact.create({
        data: {
          name: 'Stavros Papadopoulos',
          email: 'spapadopoulos@hellas.gr',
          mobile: '+30 694 123 4567',
          businessPhone: '+30 210 429 1234',
          ownerId: owner3.id,
        },
      }),
  );
  await findOrCreate(
    () => prisma.contact.findFirst({ where: { name: 'María José Suárez', charterId: ch2.id } }),
    () =>
      prisma.contact.create({
        data: {
          name: 'María José Suárez',
          email: 'mjsuarez@bunge.com.uy',
          mobile: '+598 99 200 400',
          businessPhone: '+598 2 2000 3300',
          charterId: ch2.id,
        },
      }),
  );
  await findOrCreate(
    () => prisma.contact.findFirst({ where: { name: 'Roberto Herrera', operatorId: op3.id } }),
    () =>
      prisma.contact.create({
        data: {
          name: 'Roberto Herrera',
          email: 'rherrera@ultramar.com.uy',
          mobile: '+598 99 916 2299',
          businessPhone: '+598 2 916 2200',
          operatorId: op3.id,
        },
      }),
  );
  await findOrCreate(
    () => prisma.contact.findFirst({ where: { name: 'Jean-Paul Martin', charterId: ch3.id } }),
    () =>
      prisma.contact.create({
        data: {
          name: 'Jean-Paul Martin',
          email: 'jpmartin@ldc.com',
          mobile: '+54 9 11 4000 8001',
          businessPhone: '+54 11 4000 8000',
          charterId: ch3.id,
        },
      }),
  );
  await findOrCreate(
    () => prisma.contact.findFirst({ where: { name: 'Gonzalo Ferreiro', ownerId: owner2.id } }),
    () =>
      prisma.contact.create({
        data: {
          name: 'Gonzalo Ferreiro',
          email: 'gferreiro@patagoniamarine.com',
          mobile: '+507 6340 9911',
          businessPhone: '+507 340 9900',
          ownerId: owner2.id,
        },
      }),
  );
  await findOrCreate(
    () => prisma.contact.findFirst({ where: { name: 'Andrea Vieira', operatorId: op4.id } }),
    () =>
      prisma.contact.create({
        data: {
          name: 'Andrea Vieira',
          email: 'avieira@sudatlantic.com',
          mobile: '+54 9 11 4311 7891',
          businessPhone: '+54 11 4311 7890',
          operatorId: op4.id,
        },
      }),
  );
  console.log('Seeded 10 contacts');

  // ---------------------------------------------------------------------------
  // Branches (10)
  // ---------------------------------------------------------------------------
  const branchMVD = await prisma.branch.upsert({
    where: { code: 'MVD' },
    update: {
      email: 'mvd@portlog.local',
      address: 'Rambla 25 de Agosto de 1825 s/n, Puerto de Montevideo, Uruguay.',
      phone: '+598 2915 4400',
      fax: '+598 2915 4401',
      mobile24h: '+598 99 100 200',
      coverage: 'Puerto de Montevideo, Terminal TCP y Grandes Lagos.',
      contactName: 'Sr. Roberto Álvarez',
      contactTitle: 'Operations Manager',
      contactMobile: '+598 99 111 222',
      contactEmail: 'ops.mvd@portlog.local',
      centralEmails: ['admin@portlog.local', 'ops@portlog.local'],
    },
    create: {
      name: 'Montevideo',
      code: 'MVD',
      comments: 'Sede central. Puerto de Montevideo.',
      email: 'mvd@portlog.local',
      address: 'Rambla 25 de Agosto de 1825 s/n, Puerto de Montevideo, Uruguay.',
      phone: '+598 2915 4400',
      fax: '+598 2915 4401',
      mobile24h: '+598 99 100 200',
      coverage: 'Puerto de Montevideo, Terminal TCP y Grandes Lagos.',
      contactName: 'Sr. Roberto Álvarez',
      contactTitle: 'Operations Manager',
      contactMobile: '+598 99 111 222',
      contactEmail: 'ops.mvd@portlog.local',
      centralEmails: ['admin@portlog.local', 'ops@portlog.local'],
    },
  });
  const branchNPA = await prisma.branch.upsert({
    where: { code: 'NPA' },
    update: {
      email: 'npa@portlog.local',
      address: 'Av. Artigas 350, Nueva Palmira, Colonia, Uruguay.',
      phone: '+598 4554 2100',
      fax: '+598 4554 2101',
      mobile24h: '+598 99 300 400',
      coverage: 'Terminal Granelera de Nueva Palmira, Zona Franca UP-River.',
      contactName: 'Sr. Jorge Pereira',
      contactTitle: 'Branch Supervisor',
      contactMobile: '+598 99 333 444',
      contactEmail: 'ops.npa@portlog.local',
      centralEmails: ['admin@portlog.local', 'ops@portlog.local'],
    },
    create: {
      name: 'Nueva Palmira',
      code: 'NPA',
      comments: 'Terminal granelera del litoral uruguayo.',
      email: 'npa@portlog.local',
      address: 'Av. Artigas 350, Nueva Palmira, Colonia, Uruguay.',
      phone: '+598 4554 2100',
      fax: '+598 4554 2101',
      mobile24h: '+598 99 300 400',
      coverage: 'Terminal Granelera de Nueva Palmira, Zona Franca UP-River.',
      contactName: 'Sr. Jorge Pereira',
      contactTitle: 'Branch Supervisor',
      contactMobile: '+598 99 333 444',
      contactEmail: 'ops.npa@portlog.local',
      centralEmails: ['admin@portlog.local', 'ops@portlog.local'],
    },
  });
  const branchFBT = await prisma.branch.upsert({
    where: { code: 'FBT' },
    update: {
      email: 'fbt@portlog.local',
      address: 'Puerto de Fray Bentos, Río Uruguay, Uruguay.',
      phone: '+598 4562 3200',
      fax: '+598 4562 3201',
      mobile24h: '+598 99 500 600',
      coverage: 'Puerto de Fray Bentos, Terminal de Celulosa UPM.',
      contactName: 'Sr. Andrés Cabrera',
      contactTitle: 'Port Agent',
      contactMobile: '+598 99 555 666',
      contactEmail: 'ops.fbt@portlog.local',
      centralEmails: ['admin@portlog.local', 'ops@portlog.local'],
    },
    create: {
      name: 'Fray Bentos',
      code: 'FBT',
      comments: 'Puerto fluvial, celulosa y productos forestales.',
      email: 'fbt@portlog.local',
      address: 'Puerto de Fray Bentos, Río Uruguay, Uruguay.',
      phone: '+598 4562 3200',
      fax: '+598 4562 3201',
      mobile24h: '+598 99 500 600',
      coverage: 'Puerto de Fray Bentos, Terminal de Celulosa UPM.',
      contactName: 'Sr. Andrés Cabrera',
      contactTitle: 'Port Agent',
      contactMobile: '+598 99 555 666',
      contactEmail: 'ops.fbt@portlog.local',
      centralEmails: ['admin@portlog.local', 'ops@portlog.local'],
    },
  });
  await prisma.branch.upsert({
    where: { code: 'BUE' },
    update: {},
    create: {
      name: 'Buenos Aires',
      code: 'BUE',
      comments: 'Corresponsalía en Puerto Buenos Aires.',
    },
  });
  await prisma.branch.upsert({
    where: { code: 'ROS' },
    update: {},
    create: {
      name: 'Rosario',
      code: 'ROS',
      comments: 'Zona Up-River. Principales terminales graneleras del Paraná.',
    },
  });
  await prisma.branch.upsert({
    where: { code: 'BBL' },
    update: {},
    create: {
      name: 'Bahía Blanca',
      code: 'BBL',
      comments: 'Puerto de aguas profundas en el sur de Argentina.',
    },
  });
  await prisma.branch.upsert({
    where: { code: 'COL' },
    update: {},
    create: { name: 'Colonia', code: 'COL', comments: 'Terminal de pasajeros y carga menor.' },
  });
  await prisma.branch.upsert({
    where: { code: 'PYS' },
    update: {},
    create: { name: 'Paysandú', code: 'PYS', comments: 'Puerto fluvial sobre el Río Uruguay.' },
  });
  await prisma.branch.upsert({
    where: { code: 'JSE' },
    update: {},
    create: { name: 'José Ignacio', code: 'JSE', comments: 'Pequeño puerto turístico y náutico.' },
  });
  await prisma.branch.upsert({
    where: { code: 'PLC' },
    update: {},
    create: { name: 'La Paloma', code: 'PLC', comments: 'Puerto pesquero y deportivo.' },
  });
  await await prisma.branch.upsert({
    where: { code: 'LGR' },
    update: {
      name: 'La Guaira Branch Office',
      email: 'lgr@navieramar.com',
      address:
        'Avenida Principal De Weekend con 3ra Transversal Edificio San Miguel, Piso 1, Oficina 08, Catia La Mar, Estado Vargas, Venezuela.',
      phone: '+58 212 3520194',
      fax: '+58 212 3523611',
      mobile24h: '+58 424 8191810 / +58 416 6841627',
      coverage: 'Catia La Mar and Tacoa Terminals, Bolipuertos La Guaira.',
      contactName: 'Ms. Cindy Moreno',
      contactTitle: 'Branch Manager',
      contactMobile: '+58 424 1433684',
      contactEmail: 'lgrmgr@navieramar.com',
      centralEmails: ['opsmgr@navieramar.com', 'genmgr@navieramar.com', 'asistmgr@navieramar.com'],
    },
    create: {
      name: 'La Guaira Branch Office',
      code: 'LGR',
      email: 'lgr@navieramar.com',
      address:
        'Avenida Principal De Weekend con 3ra Transversal Edificio San Miguel, Piso 1, Oficina 08, Catia La Mar, Estado Vargas, Venezuela.',
      phone: '+58 212 3520194',
      fax: '+58 212 3523611',
      mobile24h: '+58 424 8191810 / +58 416 6841627',
      coverage: 'Catia La Mar and Tacoa Terminals, Bolipuertos La Guaira.',
      contactName: 'Ms. Cindy Moreno',
      contactTitle: 'Branch Manager',
      contactMobile: '+58 424 1433684',
      contactEmail: 'lgrmgr@navieramar.com',
      centralEmails: ['opsmgr@navieramar.com', 'genmgr@navieramar.com', 'asistmgr@navieramar.com'],
    },
  });
  console.log('Seeded 11 branches');

  // ---------------------------------------------------------------------------
  // Ship Particulars (10)
  // ---------------------------------------------------------------------------
  const vessel1 = await prisma.shipParticular.upsert({
    where: { callSign: 'LMAB' },
    update: {},
    create: {
      callSign: 'LMAB',
      name: 'MV Nordic Star',
      abbreviation: 'NSTAR',
      imoNumber: '9876543',
      loa: 189.9,
      dwt: 32000,
      grt: 19500,
      nrt: 9800,
      email: 'captain@nordicstar.no',
      phone: '+47 900 12345',
      flagId: flags['MH']!,
      ownerId: owner1.id,
      operatorId: op1.id,
      comments: 'Bulkcarrier. Calado máximo en MVD: 10.5m.',
    },
  });
  const vessel2 = await prisma.shipParticular.upsert({
    where: { callSign: 'HPAC' },
    update: {},
    create: {
      callSign: 'HPAC',
      name: 'MV Patagonia Trader',
      abbreviation: 'PTRADER',
      imoNumber: '9123456',
      loa: 225.0,
      dwt: 68000,
      grt: 38000,
      nrt: 18000,
      flagId: flags['PA']!,
      ownerId: owner2.id,
      operatorId: op2.id,
      comments: 'Panamax. Requiere remolcador en MVD siempre.',
    },
  });
  const vessel3 = await prisma.shipParticular.upsert({
    where: { callSign: 'GYMT' },
    update: {},
    create: {
      callSign: 'GYMT',
      name: 'MV Río Plata Spirit',
      abbreviation: 'RPSPIRIT',
      imoNumber: '9234567',
      loa: 145.0,
      dwt: 12000,
      grt: 8500,
      nrt: 4200,
      flagId: flags['UY']!,
      comments: 'Buque de bandera uruguaya. Cabotaje regional.',
    },
  });
  const vessel4 = await prisma.shipParticular.upsert({
    where: { callSign: 'SVCR' },
    update: {},
    create: {
      callSign: 'SVCR',
      name: 'MV Hellas Carrier',
      abbreviation: 'HELCAR',
      imoNumber: '9345678',
      loa: 199.5,
      dwt: 46000,
      grt: 26000,
      nrt: 12000,
      email: 'master@hellascarrier.gr',
      phone: '+30 694 333 4444',
      flagId: flags['GR']!,
      ownerId: owner3.id,
      operatorId: op3.id,
      comments: 'Handymax granel. Calado máx.: 12m.',
    },
  });
  const vessel5 = await prisma.shipParticular.upsert({
    where: { callSign: 'LBST' },
    update: {},
    create: {
      callSign: 'LBST',
      name: 'MV Liberian Star',
      abbreviation: 'LBSTAR',
      imoNumber: '9456789',
      loa: 176.0,
      dwt: 28000,
      grt: 17000,
      nrt: 8500,
      flagId: flags['LR']!,
      ownerId: owner4.id,
      operatorId: op4.id,
    },
  });
  const vessel6 = await prisma.shipParticular.upsert({
    where: { callSign: 'BHMT' },
    update: {},
    create: {
      callSign: 'BHMT',
      name: 'MV Bahamas Merchant',
      abbreviation: 'BAHMRC',
      imoNumber: '9567890',
      loa: 183.0,
      dwt: 33500,
      grt: 20000,
      nrt: 10200,
      flagId: flags['BS']!,
      ownerId: owner5.id,
      operatorId: op1.id,
    },
  });
  const vessel7 = await prisma.shipParticular.upsert({
    where: { callSign: 'CYBL' },
    update: {},
    create: {
      callSign: 'CYBL',
      name: 'MV Cyprus Bulker',
      abbreviation: 'CYPBLK',
      imoNumber: '9678901',
      loa: 210.0,
      dwt: 57000,
      grt: 32000,
      nrt: 15500,
      flagId: flags['CY']!,
      operatorId: op2.id,
      comments: 'Post-Panamax, requiere piloto en MVD.',
    },
  });
  const vessel8 = await prisma.shipParticular.upsert({
    where: { callSign: 'NOFD' },
    update: {},
    create: {
      callSign: 'NOFD',
      name: 'MV Norwegian Fjord',
      abbreviation: 'NFJORD',
      imoNumber: '9789012',
      loa: 156.0,
      dwt: 18000,
      grt: 11000,
      nrt: 5500,
      flagId: flags['NO']!,
      operatorId: op1.id,
    },
  });
  const vessel9 = await prisma.shipParticular.upsert({
    where: { callSign: 'SGOC' },
    update: {},
    create: {
      callSign: 'SGOC',
      name: 'MV Singapore Ocean',
      abbreviation: 'SGOCN',
      imoNumber: '9890123',
      loa: 240.0,
      dwt: 75000,
      grt: 42000,
      nrt: 20000,
      flagId: flags['SG']!,
      operatorId: op3.id,
      comments: 'Capesize. Solo opera NPA o San Lorenzo.',
    },
  });
  const vessel10 = await prisma.shipParticular.upsert({
    where: { callSign: 'MALT' },
    update: {},
    create: {
      callSign: 'MALT',
      name: 'MV Malta Trader',
      abbreviation: 'MLTRD',
      imoNumber: '9901234',
      loa: 169.5,
      dwt: 24000,
      grt: 15000,
      nrt: 7200,
      flagId: flags['MT']!,
      operatorId: op4.id,
    },
  });
  console.log('Seeded 10 ship particulars');

  // ---------------------------------------------------------------------------
  // Email Groups (10)
  // ---------------------------------------------------------------------------
  await findOrCreate(
    () => prisma.emailGroup.findFirst({ where: { name: 'Autoridades Portuarias' } }),
    () =>
      prisma.emailGroup.create({
        data: {
          name: 'Autoridades Portuarias',
          description: 'Prefectura Nacional Naval y ANP',
          members: {
            create: [
              {
                email: 'prefectura@armada.mil.uy',
                displayName: 'Prefectura Nacional Naval',
                order: 0,
              },
              { email: 'operaciones@anp.com.uy', displayName: 'ANP Operaciones', order: 1 },
            ],
          },
        },
      }),
  );
  await findOrCreate(
    () => prisma.emailGroup.findFirst({ where: { name: 'Equipo Agencia' } }),
    () =>
      prisma.emailGroup.create({
        data: {
          name: 'Equipo Agencia',
          description: 'Personal interno de la agencia',
          members: {
            create: [
              { email: 'admin@portlog.local', displayName: 'Administración', order: 0 },
              { email: 'ops@portlog.local', displayName: 'Operaciones', order: 1 },
            ],
          },
        },
      }),
  );
  await findOrCreate(
    () => prisma.emailGroup.findFirst({ where: { name: 'Operador / Armador' } }),
    () =>
      prisma.emailGroup.create({
        data: {
          name: 'Operador / Armador',
          description: 'Contactos del operador y armador del buque',
          members: {
            create: [
              {
                email: 'cfernandez@granosdelsur.com.uy',
                displayName: 'Carlos Fernández',
                order: 0,
              },
              { email: 'leriksen@nordicbulk.no', displayName: 'Lars Eriksen', order: 1 },
            ],
          },
        },
      }),
  );
  await findOrCreate(
    () => prisma.emailGroup.findFirst({ where: { name: 'Fletadores Graneles' } }),
    () =>
      prisma.emailGroup.create({
        data: {
          name: 'Fletadores Graneles',
          description: 'Cargill, Bunge y Louis Dreyfus',
          members: {
            create: [
              { email: 'chartering@cargill.com.uy', displayName: 'Cargill Chartering', order: 0 },
              { email: 'ops@bunge.com.uy', displayName: 'Bunge Ops', order: 1 },
              { email: 'chartering@ldc.com', displayName: 'LDC Chartering', order: 2 },
            ],
          },
        },
      }),
  );
  await findOrCreate(
    () => prisma.emailGroup.findFirst({ where: { name: 'Prácticos y Remolcadores' } }),
    () =>
      prisma.emailGroup.create({
        data: {
          name: 'Prácticos y Remolcadores',
          description: 'Coordinación de maniobras en puerto',
          members: {
            create: [
              { email: 'practicos@anp.com.uy', displayName: 'Practicaje ANP', order: 0 },
              { email: 'ops@remolcadores.com.uy', displayName: 'Remolcadores del Sur', order: 1 },
            ],
          },
        },
      }),
  );
  await findOrCreate(
    () => prisma.emailGroup.findFirst({ where: { name: 'Control e Inspección' } }),
    () =>
      prisma.emailGroup.create({
        data: {
          name: 'Control e Inspección',
          description: 'Entidades de control de carga',
          members: {
            create: [
              { email: 'inspecciones@controlnaval.com.uy', displayName: 'Control Naval', order: 0 },
              { email: 'afcalidad@sgsi.com.uy', displayName: 'SGS Inspecciones', order: 1 },
            ],
          },
        },
      }),
  );
  await findOrCreate(
    () => prisma.emailGroup.findFirst({ where: { name: 'Salud y Sanidad' } }),
    () =>
      prisma.emailGroup.create({
        data: {
          name: 'Salud y Sanidad',
          description: 'Servicios médicos y sanitarios',
          members: {
            create: [
              { email: 'medico@medicapuerto.com.uy', displayName: 'Médica Puerto', order: 0 },
              { email: 'sanidad@msp.gub.uy', displayName: 'MSP Sanidad', order: 1 },
            ],
          },
        },
      }),
  );
  await findOrCreate(
    () => prisma.emailGroup.findFirst({ where: { name: 'Proveedores Bunker' } }),
    () =>
      prisma.emailGroup.create({
        data: {
          name: 'Proveedores Bunker',
          description: 'Suministradores de combustible y agua',
          members: {
            create: [
              {
                email: 'bunker@aguasycombustibles.com.uy',
                displayName: 'Aguas y Combustibles',
                order: 0,
              },
              { email: 'bunker@ancap.com.uy', displayName: 'ANCAP Bunker', order: 1 },
            ],
          },
        },
      }),
  );
  await findOrCreate(
    () => prisma.emailGroup.findFirst({ where: { name: 'Aduana y Frontera' } }),
    () =>
      prisma.emailGroup.create({
        data: {
          name: 'Aduana y Frontera',
          description: 'Aduana Nacional y Ministerio de Economía',
          members: {
            create: [
              { email: 'maritima@aduana.gub.uy', displayName: 'Aduana Nacional', order: 0 },
              { email: 'frontera@mef.gub.uy', displayName: 'MEF Control Frontera', order: 1 },
            ],
          },
        },
      }),
  );
  await findOrCreate(
    () => prisma.emailGroup.findFirst({ where: { name: 'Capitanes de Puerto' } }),
    () =>
      prisma.emailGroup.create({
        data: {
          name: 'Capitanes de Puerto',
          description: 'Capitanía del Puerto de Montevideo y zona',
          members: {
            create: [
              { email: 'capitania@armada.mil.uy', displayName: 'Capitanía MVD', order: 0 },
              { email: 'capitania.npa@armada.mil.uy', displayName: 'Capitanía NPA', order: 1 },
            ],
          },
        },
      }),
  );
  console.log('Seeded 10 email groups');

  // ---------------------------------------------------------------------------
  // Nominations (10)
  // ---------------------------------------------------------------------------
  const nom1 = await prisma.nomination.upsert({
    where: { correlative: 1 },
    update: {},
    create: {
      voyageNumber: '001/MVD',
      voyageCode: 'GRA',
      shipParticularId: vessel1.id,
      opPortId: mvdPort.id,
      pierId: pierMvdC.id,
      lastPortId: baPort.id,
      nextPortId: baPort.id,
      branchId: branchMVD.id,
      dateNominated: new Date('2026-05-20T10:00:00Z'),
      etaDate: new Date('2026-05-28T06:00:00Z'),
      nominationType: NominationType.FULL_AGENCY,
      status: NominationStatus.DRAFT,
      nominatedById: opsUser.id,
      master: 'Capt. John Anderson',
      parcels: [{ product: 'Soja', quantity: 25000, unit: 'MT', operation: 'Carga' }],
      createdById: opsUser.id,
      statusHistory: {
        create: { fromStatus: null, toStatus: NominationStatus.DRAFT, changedById: opsUser.id },
      },
    },
  });
  const nom2 = await prisma.nomination.upsert({
    where: { correlative: 2 },
    update: {},
    create: {
      voyageNumber: '002/MVD',
      voyageCode: 'GRA',
      shipParticularId: vessel2.id,
      opPortId: mvdPort.id,
      pierId: pierMvdD.id,
      lastPortId: npPort.id,
      branchId: branchMVD.id,
      dateNominated: new Date('2026-05-15T08:00:00Z'),
      etaDate: new Date('2026-05-22T14:00:00Z'),
      nominationType: NominationType.FULL_AGENCY,
      status: NominationStatus.IN_PROGRESS,
      nominatedById: opsUser.id,
      master: 'Capt. María García',
      parcels: [{ product: 'Trigo', quantity: 60000, unit: 'MT', operation: 'Descarga' }],
      createdById: adminUser.id,
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: NominationStatus.DRAFT, changedById: adminUser.id },
          {
            fromStatus: NominationStatus.DRAFT,
            toStatus: NominationStatus.CONFIRMED,
            changedById: adminUser.id,
          },
          {
            fromStatus: NominationStatus.CONFIRMED,
            toStatus: NominationStatus.IN_PROGRESS,
            changedById: adminUser.id,
          },
        ],
      },
    },
  });
  await prisma.nomination.upsert({
    where: { correlative: 3 },
    update: {},
    create: {
      voyageNumber: '003/NPA',
      voyageCode: 'CEL',
      shipParticularId: vessel3.id,
      opPortId: npPort.id,
      pierId: pierNpaMain.id,
      branchId: branchNPA.id,
      dateNominated: new Date('2026-05-22T09:00:00Z'),
      etaDate: new Date('2026-06-01T10:00:00Z'),
      nominationType: NominationType.OWNERS_AGENTS_ONLY,
      status: NominationStatus.CONFIRMED,
      master: 'Capt. Roberto Silva',
      parcels: [{ product: 'Celulosa', quantity: 10000, unit: 'MT', operation: 'Carga' }],
      createdById: opsUser.id,
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: NominationStatus.DRAFT, changedById: opsUser.id },
          {
            fromStatus: NominationStatus.DRAFT,
            toStatus: NominationStatus.CONFIRMED,
            changedById: adminUser.id,
          },
        ],
      },
    },
  });
  const nom4 = await prisma.nomination.upsert({
    where: { correlative: 4 },
    update: {},
    create: {
      voyageNumber: '004/MVD',
      voyageCode: 'GRA',
      shipParticularId: vessel4.id,
      opPortId: mvdPort.id,
      pierId: pierMvdTCP.id,
      lastPortId: rosarioPort.id,
      branchId: branchMVD.id,
      dateNominated: new Date('2026-06-01T09:00:00Z'),
      etaDate: new Date('2026-06-08T08:00:00Z'),
      nominationType: NominationType.FULL_AGENCY,
      status: NominationStatus.CONFIRMED,
      nominatedById: user3.id,
      master: 'Capt. Nikos Papadakis',
      parcels: [{ product: 'Maíz', quantity: 45000, unit: 'MT', operation: 'Descarga' }],
      createdById: user3.id,
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: NominationStatus.DRAFT, changedById: user3.id },
          {
            fromStatus: NominationStatus.DRAFT,
            toStatus: NominationStatus.CONFIRMED,
            changedById: adminUser.id,
          },
        ],
      },
    },
  });
  const nom5 = await prisma.nomination.upsert({
    where: { correlative: 5 },
    update: {},
    create: {
      voyageNumber: '005/NPA',
      voyageCode: 'SOJ',
      shipParticularId: vessel5.id,
      opPortId: npPort.id,
      pierId: pierNpaFluv.id,
      nextPortId: baPort.id,
      branchId: branchNPA.id,
      dateNominated: new Date('2026-06-03T14:00:00Z'),
      etaDate: new Date('2026-06-10T06:00:00Z'),
      nominationType: NominationType.FULL_AGENCY,
      status: NominationStatus.IN_PROGRESS,
      nominatedById: user4.id,
      master: 'Capt. Igor Volkov',
      parcels: [
        { product: 'Soja', quantity: 28000, unit: 'MT', operation: 'Carga' },
        { product: 'Maíz', quantity: 5000, unit: 'MT', operation: 'Carga' },
      ],
      createdById: user4.id,
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: NominationStatus.DRAFT, changedById: user4.id },
          {
            fromStatus: NominationStatus.DRAFT,
            toStatus: NominationStatus.CONFIRMED,
            changedById: adminUser.id,
          },
          {
            fromStatus: NominationStatus.CONFIRMED,
            toStatus: NominationStatus.IN_PROGRESS,
            changedById: user4.id,
          },
        ],
      },
    },
  });
  await prisma.nomination.upsert({
    where: { correlative: 6 },
    update: {},
    create: {
      voyageNumber: '006/MVD',
      voyageCode: 'FER',
      shipParticularId: vessel6.id,
      opPortId: mvdPort.id,
      pierId: pierMvdGdP.id,
      branchId: branchMVD.id,
      dateNominated: new Date('2026-06-05T10:00:00Z'),
      etaDate: new Date('2026-06-14T12:00:00Z'),
      nominationType: NominationType.CHARTERERS_AGENTS_ONLY,
      status: NominationStatus.DRAFT,
      master: 'Capt. James Morrison',
      parcels: [{ product: 'Fertilizantes', quantity: 32000, unit: 'MT', operation: 'Descarga' }],
      createdById: opsUser.id,
      statusHistory: {
        create: { fromStatus: null, toStatus: NominationStatus.DRAFT, changedById: opsUser.id },
      },
    },
  });
  await prisma.nomination.upsert({
    where: { correlative: 7 },
    update: {},
    create: {
      voyageNumber: '007/FBT',
      voyageCode: 'CEL',
      shipParticularId: vessel7.id,
      opPortId: npPort.id,
      pierId: pierNpaFisc.id,
      lastPortId: baPort.id,
      branchId: branchFBT.id,
      dateNominated: new Date('2026-06-07T08:00:00Z'),
      etaDate: new Date('2026-06-15T10:00:00Z'),
      nominationType: NominationType.FULL_AGENCY,
      status: NominationStatus.COMPLETED,
      master: 'Capt. Anastasios Dimas',
      parcels: [{ product: 'Celulosa', quantity: 55000, unit: 'MT', operation: 'Carga' }],
      createdById: adminUser.id,
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: NominationStatus.DRAFT, changedById: opsUser.id },
          {
            fromStatus: NominationStatus.DRAFT,
            toStatus: NominationStatus.CONFIRMED,
            changedById: adminUser.id,
          },
          {
            fromStatus: NominationStatus.CONFIRMED,
            toStatus: NominationStatus.IN_PROGRESS,
            changedById: opsUser.id,
          },
          {
            fromStatus: NominationStatus.IN_PROGRESS,
            toStatus: NominationStatus.COMPLETED,
            changedById: adminUser.id,
          },
        ],
      },
    },
  });
  await prisma.nomination.upsert({
    where: { correlative: 8 },
    update: {},
    create: {
      voyageNumber: '008/MVD',
      voyageCode: 'COM',
      shipParticularId: vessel8.id,
      opPortId: mvdPort.id,
      pierId: pierMvdC.id,
      branchId: branchMVD.id,
      dateNominated: new Date('2026-06-10T11:00:00Z'),
      etaDate: new Date('2026-06-18T07:00:00Z'),
      nominationType: NominationType.OWNERS_AGENTS_ONLY,
      status: NominationStatus.DRAFT,
      master: 'Capt. Ole Hansen',
      parcels: [{ product: 'Carga General', quantity: 8000, unit: 'MT', operation: 'Carga' }],
      createdById: user3.id,
      statusHistory: {
        create: { fromStatus: null, toStatus: NominationStatus.DRAFT, changedById: user3.id },
      },
    },
  });
  await prisma.nomination.upsert({
    where: { correlative: 9 },
    update: {},
    create: {
      voyageNumber: '009/NPA',
      voyageCode: 'GRA',
      shipParticularId: vessel9.id,
      opPortId: npPort.id,
      pierId: pierNpaMain.id,
      nextPortId: baPort.id,
      branchId: branchNPA.id,
      dateNominated: new Date('2026-06-12T09:00:00Z'),
      etaDate: new Date('2026-06-20T06:00:00Z'),
      nominationType: NominationType.FULL_AGENCY,
      status: NominationStatus.CONFIRMED,
      nominatedById: user4.id,
      master: 'Capt. Wei Zhang',
      parcels: [{ product: 'Soja', quantity: 72000, unit: 'MT', operation: 'Carga' }],
      createdById: user4.id,
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: NominationStatus.DRAFT, changedById: user4.id },
          {
            fromStatus: NominationStatus.DRAFT,
            toStatus: NominationStatus.CONFIRMED,
            changedById: adminUser.id,
          },
        ],
      },
    },
  });
  await prisma.nomination.upsert({
    where: { correlative: 10 },
    update: {},
    create: {
      voyageNumber: '010/MVD',
      voyageCode: 'COM',
      shipParticularId: vessel10.id,
      opPortId: mvdPort.id,
      pierId: pierMvdD.id,
      lastPortId: bahiaPort.id,
      branchId: branchMVD.id,
      dateNominated: new Date('2026-06-14T08:00:00Z'),
      etaDate: new Date('2026-06-22T10:00:00Z'),
      nominationType: NominationType.FULL_AGENCY,
      status: NominationStatus.CANCELLED,
      master: 'Capt. Fernando Lima',
      parcels: [{ product: 'Trigo', quantity: 24000, unit: 'MT', operation: 'Carga' }],
      createdById: opsUser.id,
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: NominationStatus.DRAFT, changedById: opsUser.id },
          {
            fromStatus: NominationStatus.DRAFT,
            toStatus: NominationStatus.CANCELLED,
            changedById: adminUser.id,
            reason: 'Operación cancelada por el fletador.',
          },
        ],
      },
    },
  });
  // Patch opPortId + pierId on existing rows (update:{} above skips these on re-seed)
  await Promise.all([
    prisma.nomination.update({
      where: { correlative: 1 },
      data: { opPortId: mvdPort.id, pierId: pierMvdC.id },
    }),
    prisma.nomination.update({
      where: { correlative: 2 },
      data: { opPortId: mvdPort.id, pierId: pierMvdD.id },
    }),
    prisma.nomination.update({
      where: { correlative: 3 },
      data: { opPortId: npPort.id, pierId: pierNpaMain.id },
    }),
    prisma.nomination.update({
      where: { correlative: 4 },
      data: { opPortId: mvdPort.id, pierId: pierMvdTCP.id },
    }),
    prisma.nomination.update({
      where: { correlative: 5 },
      data: { opPortId: npPort.id, pierId: pierNpaFluv.id },
    }),
    prisma.nomination.update({
      where: { correlative: 6 },
      data: { opPortId: mvdPort.id, pierId: pierMvdGdP.id },
    }),
    prisma.nomination.update({
      where: { correlative: 7 },
      data: { opPortId: npPort.id, pierId: pierNpaFisc.id },
    }),
    prisma.nomination.update({
      where: { correlative: 8 },
      data: { opPortId: mvdPort.id, pierId: pierMvdC.id },
    }),
    prisma.nomination.update({
      where: { correlative: 9 },
      data: { opPortId: npPort.id, pierId: pierNpaMain.id },
    }),
    prisma.nomination.update({
      where: { correlative: 10 },
      data: { opPortId: mvdPort.id, pierId: pierMvdD.id },
    }),
  ]);
  console.log('Seeded 10 nominations');

  // ---------------------------------------------------------------------------
  // Nomination Clients (10)
  // ---------------------------------------------------------------------------
  const nomClientTargets = [
    {
      nominationId: nom1.id,
      type: 'Time Charter',
      name: 'Cargill S.A.',
      voyageRef: 'CRG-2026-001',
      referenceNo: 'TC-001',
    },
    {
      nominationId: nom1.id,
      type: 'Receivers',
      name: 'Terminal Granelera S.A.',
      voyageRef: '001/MVD',
      referenceNo: 'RCV-001',
    },
    {
      nominationId: nom2.id,
      type: 'Time Charter',
      name: 'Bunge Uruguay S.A.',
      voyageRef: 'BNG-2026-002',
      referenceNo: 'TC-002',
    },
    {
      nominationId: nom2.id,
      type: 'Receivers',
      name: 'Molinos Río de la Plata',
      voyageRef: '002/MVD',
      referenceNo: 'RCV-002',
    },
    {
      nominationId: nom2.id,
      type: 'Broker',
      name: 'Clarksons Uruguay',
      referenceNo: 'BRK-002',
      broker: 'Juan Morales',
    },
    {
      nominationId: nom4.id,
      type: 'Time Charter',
      name: 'Louis Dreyfus Company',
      voyageRef: 'LDC-2026-004',
      referenceNo: 'TC-004',
    },
    {
      nominationId: nom4.id,
      type: 'Receivers',
      name: 'Puertos del Sur S.A.',
      voyageRef: '004/MVD',
      referenceNo: 'RCV-004',
    },
    {
      nominationId: nom5.id,
      type: 'Time Charter',
      name: 'Viterra Uruguay S.A.',
      voyageRef: 'VIT-2026-005',
      referenceNo: 'TC-005',
    },
    {
      nominationId: nom5.id,
      type: 'Broker',
      name: 'BRS Brokers',
      referenceNo: 'BRK-005',
      broker: 'Pierre Dumont',
    },
    { nominationId: nom5.id, type: 'Inspection', name: 'SGS Uruguay S.A.', referenceNo: 'INS-005' },
  ];
  for (let i = 0; i < nomClientTargets.length; i++) {
    const c = nomClientTargets[i]!;
    await findOrCreate(
      () =>
        prisma.nominationClient.findFirst({
          where: { nominationId: c.nominationId, type: c.type, name: c.name },
        }),
      () => prisma.nominationClient.create({ data: { ...c, sortOrder: i } }),
    );
  }
  console.log('Seeded 10 nomination clients');

  // ---------------------------------------------------------------------------
  // PEDR — one per nomination (10 total)
  // ---------------------------------------------------------------------------
  const pedr = await findOrCreate(
    () => prisma.pedr.findUnique({ where: { nominationId: nom2.id } }),
    () =>
      prisma.pedr.create({
        data: {
          nominationId: nom2.id,
          currentStage: PedrStage.ATTENDING,
          requirements:
            'Requerir NOR inmediato al fondear. Confirmar berth con ANP antes de atraque.',
          createdById: adminUser.id,
          stageHistory: {
            create: [
              { fromStage: null, toStage: PedrStage.PRE_ARRIVAL, changedById: adminUser.id },
              {
                fromStage: PedrStage.PRE_ARRIVAL,
                toStage: PedrStage.ATTENDING,
                changedById: adminUser.id,
              },
            ],
          },
        },
      }),
  );

  const pedrNom1 = await findOrCreate(
    () => prisma.pedr.findUnique({ where: { nominationId: nom1.id } }),
    () =>
      prisma.pedr.create({
        data: {
          nominationId: nom1.id,
          currentStage: PedrStage.PRE_ARRIVAL,
          requirements: 'Solicitar lista de tripulantes 48h antes. Coordinar práctico.',
          createdById: opsUser.id,
          stageHistory: {
            create: { fromStage: null, toStage: PedrStage.PRE_ARRIVAL, changedById: opsUser.id },
          },
        },
      }),
  );

  const pedrNom4 = await findOrCreate(
    () => prisma.pedr.findUnique({ where: { nominationId: nom4.id } }),
    () =>
      prisma.pedr.create({
        data: {
          nominationId: nom4.id,
          currentStage: PedrStage.PRE_ARRIVAL,
          requirements: 'Confirmar calado máximo. Coordinar terminal.',
          createdById: user3.id,
          stageHistory: {
            create: { fromStage: null, toStage: PedrStage.PRE_ARRIVAL, changedById: user3.id },
          },
        },
      }),
  );

  const pedrNom5 = await findOrCreate(
    () => prisma.pedr.findUnique({ where: { nominationId: nom5.id } }),
    () =>
      prisma.pedr.create({
        data: {
          nominationId: nom5.id,
          currentStage: PedrStage.ATTENDING,
          requirements: 'Solicitar NOR inmediato. Coordinar estiba.',
          createdById: user4.id,
          stageHistory: {
            create: [
              { fromStage: null, toStage: PedrStage.PRE_ARRIVAL, changedById: user4.id },
              {
                fromStage: PedrStage.PRE_ARRIVAL,
                toStage: PedrStage.ATTENDING,
                changedById: user4.id,
              },
            ],
          },
        },
      }),
  );

  // Fetch re-loaded nom3, nom5 references for PEDRs
  const nom3Record = await prisma.nomination.findUnique({ where: { correlative: 3 } });
  const nom6Record = await prisma.nomination.findUnique({ where: { correlative: 6 } });
  const nom7Record = await prisma.nomination.findUnique({ where: { correlative: 7 } });
  const nom8Record = await prisma.nomination.findUnique({ where: { correlative: 8 } });
  const nom9Record = await prisma.nomination.findUnique({ where: { correlative: 9 } });
  const nom10Record = await prisma.nomination.findUnique({ where: { correlative: 10 } });

  // ---------------------------------------------------------------------------
  // Nomination Client Default Types (12 per nomination = 120 total)
  // These represent the standard client-type slots for every nomination.
  // Each row seeds with an empty name so operators can fill them in later.
  // ---------------------------------------------------------------------------
  const defaultClientTypes = [
    'Head Owner',
    'Charterer',
    'Disponent Owner',
    'Technical Operator',
    'Commercial Operator',
    'Manning Agents',
    'Catering Agents',
    'Ship Management',
    'Hub Agents',
    'Administrative Agents',
    'Time Charter',
    'Receivers',
  ];

  const allNominationIds: string[] = [
    nom1.id,
    nom2.id,
    ...(nom3Record ? [nom3Record.id] : []),
    nom4.id,
    nom5.id,
    ...(nom6Record ? [nom6Record.id] : []),
    ...(nom7Record ? [nom7Record.id] : []),
    ...(nom8Record ? [nom8Record.id] : []),
    ...(nom9Record ? [nom9Record.id] : []),
    ...(nom10Record ? [nom10Record.id] : []),
  ];

  for (const nominationId of allNominationIds) {
    for (let i = 0; i < defaultClientTypes.length; i++) {
      const type = defaultClientTypes[i]!;
      await findOrCreate(
        () =>
          prisma.nominationClient.findFirst({
            where: { nominationId, type, name: '' },
          }),
        () =>
          prisma.nominationClient.create({
            data: { nominationId, type, name: '', sortOrder: i },
          }),
      );
    }
  }
  console.log(
    `Seeded default client type slots (${defaultClientTypes.length} types × ${allNominationIds.length} nominations)`,
  );

  if (nom3Record) {
    await findOrCreate(
      () => prisma.pedr.findUnique({ where: { nominationId: nom3Record.id } }),
      () =>
        prisma.pedr.create({
          data: {
            nominationId: nom3Record.id,
            currentStage: PedrStage.ATTENDING,
            createdById: opsUser.id,
            stageHistory: {
              create: [
                { fromStage: null, toStage: PedrStage.PRE_ARRIVAL, changedById: opsUser.id },
                {
                  fromStage: PedrStage.PRE_ARRIVAL,
                  toStage: PedrStage.ATTENDING,
                  changedById: opsUser.id,
                },
              ],
            },
          },
        }),
    );
  }
  if (nom6Record) {
    await findOrCreate(
      () => prisma.pedr.findUnique({ where: { nominationId: nom6Record.id } }),
      () =>
        prisma.pedr.create({
          data: {
            nominationId: nom6Record.id,
            currentStage: PedrStage.PRE_ARRIVAL,
            createdById: opsUser.id,
            stageHistory: {
              create: { fromStage: null, toStage: PedrStage.PRE_ARRIVAL, changedById: opsUser.id },
            },
          },
        }),
    );
  }
  if (nom7Record) {
    await findOrCreate(
      () => prisma.pedr.findUnique({ where: { nominationId: nom7Record.id } }),
      () =>
        prisma.pedr.create({
          data: {
            nominationId: nom7Record.id,
            currentStage: PedrStage.CLOSING,
            createdById: adminUser.id,
            stageHistory: {
              create: [
                { fromStage: null, toStage: PedrStage.PRE_ARRIVAL, changedById: adminUser.id },
                {
                  fromStage: PedrStage.PRE_ARRIVAL,
                  toStage: PedrStage.ATTENDING,
                  changedById: adminUser.id,
                },
                {
                  fromStage: PedrStage.ATTENDING,
                  toStage: PedrStage.DISPATCH,
                  changedById: adminUser.id,
                },
                {
                  fromStage: PedrStage.DISPATCH,
                  toStage: PedrStage.CLOSING,
                  changedById: adminUser.id,
                },
              ],
            },
          },
        }),
    );
  }
  if (nom8Record) {
    await findOrCreate(
      () => prisma.pedr.findUnique({ where: { nominationId: nom8Record.id } }),
      () =>
        prisma.pedr.create({
          data: {
            nominationId: nom8Record.id,
            currentStage: PedrStage.PRE_ARRIVAL,
            createdById: user3.id,
            stageHistory: {
              create: { fromStage: null, toStage: PedrStage.PRE_ARRIVAL, changedById: user3.id },
            },
          },
        }),
    );
  }
  if (nom9Record) {
    await findOrCreate(
      () => prisma.pedr.findUnique({ where: { nominationId: nom9Record.id } }),
      () =>
        prisma.pedr.create({
          data: {
            nominationId: nom9Record.id,
            currentStage: PedrStage.PRE_ARRIVAL,
            createdById: user4.id,
            stageHistory: {
              create: { fromStage: null, toStage: PedrStage.PRE_ARRIVAL, changedById: user4.id },
            },
          },
        }),
    );
  }
  if (nom10Record) {
    await findOrCreate(
      () => prisma.pedr.findUnique({ where: { nominationId: nom10Record.id } }),
      () =>
        prisma.pedr.create({
          data: {
            nominationId: nom10Record.id,
            currentStage: PedrStage.PRE_ARRIVAL,
            createdById: opsUser.id,
            stageHistory: {
              create: { fromStage: null, toStage: PedrStage.PRE_ARRIVAL, changedById: opsUser.id },
            },
          },
        }),
    );
  }
  console.log('Seeded 10 PEDRs');

  // ---------------------------------------------------------------------------
  // PEDR Sub-Documents (11+)
  // ---------------------------------------------------------------------------
  const subDocSeeds = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      type: 'ACKNOWLEDGEMENT' as const,
      status: 'SENT' as const,
      stage: PedrStage.PRE_ARRIVAL,
      payload: {
        vesselName: 'MV Patagonia Trader',
        imo: '9123456',
        eta: '2026-05-22T14:00:00Z',
        port: 'Puerto de Montevideo',
      },
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      type: 'PREARRIVAL' as const,
      status: 'SENT' as const,
      stage: PedrStage.PRE_ARRIVAL,
      payload: {
        vesselName: 'MV Patagonia Trader',
        cargo: 'Trigo - 60,000 MT',
        lastPort: 'Nueva Palmira',
      },
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      type: 'ETA_ETB' as const,
      status: 'SENT' as const,
      stage: PedrStage.PRE_ARRIVAL,
      payload: { eta: '2026-05-22T14:00:00Z', etb: '2026-05-22T18:00:00Z', berthNumber: 'B-7' },
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      type: 'NOR' as const,
      status: 'DRAFT' as const,
      stage: PedrStage.ATTENDING,
      payload: { norTenderedAt: '2026-05-22T15:30:00Z' },
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      type: 'SOF' as const,
      status: 'DRAFT' as const,
      stage: PedrStage.ATTENDING,
      payload: { startedAt: '2026-05-23T08:00:00Z' },
    },
    {
      id: '00000000-0000-0000-0000-000000000006',
      type: 'CARGO_UPDATE' as const,
      status: 'SENT' as const,
      stage: PedrStage.ATTENDING,
      payload: { updatedQty: '58500', unit: 'MT', note: 'Ajuste de cantidad por humedad' },
    },
  ];
  for (const s of subDocSeeds) {
    await prisma.pedrSubDocument.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, pedrId: pedr.id, createdById: opsUser.id },
    });
  }

  // Sub-docs for nom1 PEDR
  const nom1SubDocSeeds = [
    {
      id: '00000000-0000-0000-0001-000000000001',
      type: 'ACKNOWLEDGEMENT' as const,
      status: 'SENT' as const,
      stage: PedrStage.PRE_ARRIVAL,
      payload: {
        vesselName: 'MV Nordic Star',
        imo: '9876543',
        eta: '2026-05-28T06:00:00Z',
        port: 'Puerto de Montevideo',
      },
    },
    {
      id: '00000000-0000-0000-0001-000000000002',
      type: 'PREARRIVAL' as const,
      status: 'DRAFT' as const,
      stage: PedrStage.PRE_ARRIVAL,
      payload: { vesselName: 'MV Nordic Star', cargo: 'Soja - 25,000 MT' },
    },
    {
      id: '00000000-0000-0000-0001-000000000003',
      type: 'ETA_ETB' as const,
      status: 'DRAFT' as const,
      stage: PedrStage.PRE_ARRIVAL,
      payload: { eta: '2026-05-28T06:00:00Z' },
    },
    {
      id: '00000000-0000-0000-0001-000000000004',
      type: 'NOR' as const,
      status: 'DRAFT' as const,
      stage: PedrStage.PRE_ARRIVAL,
      payload: {},
    },
    {
      id: '00000000-0000-0000-0001-000000000005',
      type: 'SOF' as const,
      status: 'DRAFT' as const,
      stage: PedrStage.PRE_ARRIVAL,
      payload: {},
    },
  ];
  for (const s of nom1SubDocSeeds) {
    await prisma.pedrSubDocument.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, pedrId: pedrNom1.id, createdById: opsUser.id },
    });
  }
  console.log('Seeded 11 PEDR sub-documents');

  // ---------------------------------------------------------------------------
  // PEDR Events (10+)
  // ---------------------------------------------------------------------------
  const pedrEvents = [
    {
      kind: PedrEventKind.ARRIVED,
      occurredAt: new Date('2026-05-22T13:45:00Z'),
      note: 'Fondeó en rada exterior',
    },
    {
      kind: PedrEventKind.ANCHORED,
      occurredAt: new Date('2026-05-22T14:10:00Z'),
      note: 'Anclado, berth ocupado',
    },
    {
      kind: PedrEventKind.NOR_TENDERED,
      occurredAt: new Date('2026-05-22T15:30:00Z'),
      note: 'NOR presentado a Prefectura',
    },
    {
      kind: PedrEventKind.DISCHARGE_START,
      occurredAt: new Date('2026-05-23T08:00:00Z'),
      note: 'Inicio descarga, berth B-7',
    },
    {
      kind: PedrEventKind.DISCHARGE_END,
      occurredAt: new Date('2026-05-25T18:00:00Z'),
      note: 'Descarga completada. 60,000 MT de trigo.',
    },
    {
      kind: PedrEventKind.DEPARTED,
      occurredAt: new Date('2026-05-26T07:30:00Z'),
      note: 'Zarpe hacia Buenos Aires en lastre.',
    },
  ];
  for (const ev of pedrEvents) {
    const exists = await prisma.pedrEvent.findFirst({ where: { pedrId: pedr.id, kind: ev.kind } });
    if (!exists)
      await prisma.pedrEvent.create({ data: { ...ev, pedrId: pedr.id, recordedById: opsUser.id } });
  }

  const pedrNom5Events = [
    {
      kind: PedrEventKind.ARRIVED,
      occurredAt: new Date('2026-06-10T05:45:00Z'),
      note: 'Llegada a rada exterior NPA',
    },
    {
      kind: PedrEventKind.NOR_TENDERED,
      occurredAt: new Date('2026-06-10T07:00:00Z'),
      note: 'NOR presentado',
    },
    {
      kind: PedrEventKind.ANCHORED,
      occurredAt: new Date('2026-06-10T06:30:00Z'),
      note: 'Fondeado esperando berth',
    },
    {
      kind: PedrEventKind.LOADING_START,
      occurredAt: new Date('2026-06-11T06:00:00Z'),
      note: 'Inicio carga soja terminal A',
    },
  ];
  for (const ev of pedrNom5Events) {
    const exists = await prisma.pedrEvent.findFirst({
      where: { pedrId: pedrNom5.id, kind: ev.kind },
    });
    if (!exists)
      await prisma.pedrEvent.create({
        data: { ...ev, pedrId: pedrNom5.id, recordedById: user4.id },
      });
  }
  console.log('Seeded 10 PEDR events');

  // ---------------------------------------------------------------------------
  // Documents (10)
  // ---------------------------------------------------------------------------
  const docSeeds = [
    {
      id: '10000000-0000-0000-0000-000000000001',
      nominationId: nom2.id,
      pedrId: pedr.id,
      stage: PedrStage.PRE_ARRIVAL,
      docType: 'acknowledgement',
      minioKey: 'pedrs/nom2/pre-arrival/acknowledgement-2026-05-21.pdf',
      sizeBytes: 48230,
    },
    {
      id: '10000000-0000-0000-0000-000000000002',
      nominationId: nom2.id,
      pedrId: pedr.id,
      stage: PedrStage.PRE_ARRIVAL,
      docType: 'prearrival',
      minioKey: 'pedrs/nom2/pre-arrival/prearrival-2026-05-21.pdf',
      sizeBytes: 52410,
    },
    {
      id: '10000000-0000-0000-0000-000000000003',
      nominationId: nom2.id,
      pedrId: pedr.id,
      stage: PedrStage.PRE_ARRIVAL,
      docType: 'eta_etb',
      minioKey: 'pedrs/nom2/pre-arrival/eta-etb-2026-05-21.pdf',
      sizeBytes: 39800,
    },
    {
      id: '10000000-0000-0000-0000-000000000004',
      nominationId: nom2.id,
      pedrId: pedr.id,
      stage: PedrStage.ATTENDING,
      docType: 'nor',
      minioKey: 'pedrs/nom2/attending/nor-2026-05-22.pdf',
      sizeBytes: 61200,
    },
    {
      id: '10000000-0000-0000-0000-000000000005',
      nominationId: nom2.id,
      pedrId: pedr.id,
      stage: PedrStage.ATTENDING,
      docType: 'sof',
      minioKey: 'pedrs/nom2/attending/sof-2026-05-26.pdf',
      sizeBytes: 82300,
    },
    {
      id: '10000000-0000-0000-0000-000000000006',
      nominationId: nom1.id,
      pedrId: pedrNom1.id,
      stage: PedrStage.PRE_ARRIVAL,
      docType: 'acknowledgement',
      minioKey: 'pedrs/nom1/pre-arrival/acknowledgement-2026-05-26.pdf',
      sizeBytes: 47800,
    },
    {
      id: '10000000-0000-0000-0000-000000000007',
      nominationId: nom4.id,
      pedrId: pedrNom4.id,
      stage: PedrStage.PRE_ARRIVAL,
      docType: 'acknowledgement',
      minioKey: 'pedrs/nom4/pre-arrival/acknowledgement-2026-06-02.pdf',
      sizeBytes: 49100,
    },
    {
      id: '10000000-0000-0000-0000-000000000008',
      nominationId: nom4.id,
      pedrId: pedrNom4.id,
      stage: PedrStage.PRE_ARRIVAL,
      docType: 'prearrival',
      minioKey: 'pedrs/nom4/pre-arrival/prearrival-2026-06-02.pdf',
      sizeBytes: 51300,
    },
    {
      id: '10000000-0000-0000-0000-000000000009',
      nominationId: nom5.id,
      pedrId: pedrNom5.id,
      stage: PedrStage.PRE_ARRIVAL,
      docType: 'acknowledgement',
      minioKey: 'pedrs/nom5/pre-arrival/acknowledgement-2026-06-04.pdf',
      sizeBytes: 46900,
    },
    {
      id: '10000000-0000-0000-0000-000000000010',
      nominationId: nom5.id,
      pedrId: pedrNom5.id,
      stage: PedrStage.ATTENDING,
      docType: 'nor',
      minioKey: 'pedrs/nom5/attending/nor-2026-06-10.pdf',
      sizeBytes: 59500,
    },
  ];
  for (const doc of docSeeds) {
    await prisma.document.upsert({
      where: { id: doc.id },
      update: {},
      create: { ...doc, createdById: opsUser.id },
    });
  }
  console.log('Seeded 10 documents');

  // ---------------------------------------------------------------------------
  // Email Dispatches (10)
  // ---------------------------------------------------------------------------
  for (const subDocType of ['ACKNOWLEDGEMENT', 'PREARRIVAL', 'ETA_ETB'] as const) {
    const exists = await prisma.emailDispatch.findFirst({ where: { pedrId: pedr.id, subDocType } });
    if (!exists) {
      await prisma.emailDispatch.create({
        data: {
          pedrId: pedr.id,
          subDocType,
          toAddresses: ['prefectura@armada.mil.uy', 'operaciones@anp.com.uy'],
          ccAddresses: ['ops@portlog.local'],
          subject: `${subDocType} — MV Patagonia Trader`,
          bodyHtml: `<p>Estimados, adjunto ${subDocType} para MV Patagonia Trader.</p>`,
          sentAt: new Date('2026-05-21T12:00:00Z'),
          sentById: opsUser.id,
        },
      });
    }
  }
  for (const subDocType of ['NOR', 'SOF', 'CARGO_UPDATE'] as const) {
    const exists = await prisma.emailDispatch.findFirst({ where: { pedrId: pedr.id, subDocType } });
    if (!exists) {
      await prisma.emailDispatch.create({
        data: {
          pedrId: pedr.id,
          subDocType,
          toAddresses: ['cfernandez@granosdelsur.com.uy', 'leriksen@nordicbulk.no'],
          ccAddresses: ['admin@portlog.local'],
          subject: `${subDocType} — MV Patagonia Trader`,
          bodyHtml: `<p>Estimados, adjunto ${subDocType} para MV Patagonia Trader.</p>`,
          sentAt: new Date('2026-05-22T16:00:00Z'),
          sentById: opsUser.id,
        },
      });
    }
  }
  for (const subDocType of ['ACKNOWLEDGEMENT', 'PREARRIVAL', 'ETA_ETB', 'NOR'] as const) {
    const exists = await prisma.emailDispatch.findFirst({
      where: { pedrId: pedrNom5.id, subDocType },
    });
    if (!exists) {
      await prisma.emailDispatch.create({
        data: {
          pedrId: pedrNom5.id,
          subDocType,
          toAddresses: ['prefectura@armada.mil.uy'],
          ccAddresses: ['ops@portlog.local'],
          subject: `${subDocType} — MV Liberian Star`,
          bodyHtml: `<p>Estimados, adjunto ${subDocType} para MV Liberian Star.</p>`,
          sentAt: new Date('2026-06-04T10:00:00Z'),
          sentById: user4.id,
        },
      });
    }
  }
  console.log('Seeded 10 email dispatches');

  // ---------------------------------------------------------------------------
  // SH Documents (10)
  // ---------------------------------------------------------------------------
  const shDocSeeds = [
    {
      id: '00000000-0000-0000-0001-000000000001',
      nominationId: nom2.id,
      type: SHDocumentType.COMMENT,
      status: SHDocumentStatus.DRAFT,
      data: {
        type: 'COMMENT',
        html: 'Buque llegó con retraso por mal tiempo. Capitán solicitó cambio de tripulación urgente.',
      },
    },
    {
      id: '00000000-0000-0000-0001-000000000002',
      nominationId: nom2.id,
      type: SHDocumentType.SH_66A,
      status: SHDocumentStatus.DRAFT,
      data: {
        type: 'SH_66A',
        vesselReference: 'PTR-2026-045',
        notes: 'Horas extras por atraco nocturno.',
        rows: [{ date: '2026-05-22', from: '20:00', to: '23:00', activity: 'Atraque nocturno' }],
      },
    },
    {
      id: '00000000-0000-0000-0001-000000000003',
      nominationId: nom2.id,
      type: SHDocumentType.SH_09A,
      status: SHDocumentStatus.FINALIZED,
      data: {
        type: 'SH_09A',
        patientName: 'Iván Petrov',
        rank: 'Segundo Oficial',
        vesselName: 'MV Patagonia Trader',
        diagnosis: 'Lumbalgia aguda',
        body: 'Se garantiza atención médica para el tripulante.',
        issuedAt: '2026-05-23',
      },
    },
    {
      id: '00000000-0000-0000-0001-000000000004',
      nominationId: nom2.id,
      type: SHDocumentType.SH_28A,
      status: SHDocumentStatus.DRAFT,
      data: {
        type: 'SH_28A',
        awbOrInvoice: 'AWB-2026-78432',
        supplier: 'DHL Express',
        receivedBy: 'Carlos Fernández',
        rows: [{ description: 'Bomba hidráulica de repuesto', qty: 1, unit: 'pcs', weightKg: 45 }],
      },
    },
    {
      id: '00000000-0000-0000-0001-000000000005',
      nominationId: nom1.id,
      type: SHDocumentType.COMMENT,
      status: SHDocumentStatus.DRAFT,
      data: { type: 'COMMENT', html: 'Nominación recibida. Pendiente confirmación ETA.' },
    },
    {
      id: '00000000-0000-0000-0001-000000000006',
      nominationId: nom4.id,
      type: SHDocumentType.SH_66A,
      status: SHDocumentStatus.SENT,
      title: 'Overtime 2026-06-08',
      data: {
        type: 'SH_66A',
        vesselReference: 'HLC-2026-004',
        notes: 'Horas extras por inicio de descarga nocturna.',
        rows: [
          { date: '2026-06-08', from: '22:00', to: '01:00', activity: 'Inicio descarga nocturna' },
        ],
      },
    },
    {
      id: '00000000-0000-0000-0001-000000000007',
      nominationId: nom4.id,
      type: SHDocumentType.COMMENT,
      status: SHDocumentStatus.DRAFT,
      data: {
        type: 'COMMENT',
        html: 'Calado máximo confirmado: 11.8m. Sin inconvenientes en barra.',
      },
    },
    {
      id: '00000000-0000-0000-0001-000000000008',
      nominationId: nom5.id,
      type: SHDocumentType.SH_09A,
      status: SHDocumentStatus.DRAFT,
      data: {
        type: 'SH_09A',
        patientName: 'Dmitri Sokolov',
        rank: 'Contramaestre',
        vesselName: 'MV Liberian Star',
        diagnosis: 'Corte profundo en mano derecha',
        body: 'Se autoriza atención en clínica habilitada.',
        issuedAt: '2026-06-11',
      },
    },
    {
      id: '00000000-0000-0000-0001-000000000009',
      nominationId: nom5.id,
      type: SHDocumentType.SH_28A,
      status: SHDocumentStatus.FINALIZED,
      data: {
        type: 'SH_28A',
        awbOrInvoice: 'AWB-2026-91122',
        supplier: 'FedEx Uruguay',
        receivedBy: 'Pablo Giménez',
        rows: [
          { description: 'Válvula de repuesto motor principal', qty: 2, unit: 'pcs', weightKg: 12 },
        ],
      },
    },
    {
      id: '00000000-0000-0000-0001-000000000010',
      nominationId: nom5.id,
      type: SHDocumentType.OTHER,
      status: SHDocumentStatus.DRAFT,
      data: {
        type: 'OTHER',
        html: 'Solicitud de fumigación de bodega antes de inicio de carga. Coordinado con terminal NPA.',
      },
    },
  ];
  for (const doc of shDocSeeds) {
    await prisma.sHDocument.upsert({
      where: { id: doc.id },
      update: {},
      create: { ...doc, createdById: opsUser.id },
    });
  }
  console.log('Seeded 10 SH documents');

  // ---------------------------------------------------------------------------
  // SH Document Dispatches (10)
  // ---------------------------------------------------------------------------
  const shDoc3 = shDocSeeds[2]!;
  const shDoc6 = shDocSeeds[5]!;
  const shDoc9 = shDocSeeds[8]!;

  const shDispatchTargets = [
    {
      shDocumentId: shDoc3.id,
      to: ['prefectura@armada.mil.uy'],
      cc: ['ops@portlog.local'],
      subject: 'SH-09A — Iván Petrov — MV Patagonia Trader',
      key: 'sh-docs/nom2/sh09a-petrov-2026-05-23.pdf',
      sent: new Date('2026-05-23T11:00:00Z'),
      sentById: opsUser.id,
    },
    {
      shDocumentId: shDoc3.id,
      to: ['medico@medicapuerto.com.uy'],
      cc: [],
      subject: 'SH-09A Copia Clínica — Iván Petrov',
      key: 'sh-docs/nom2/sh09a-petrov-clinica-2026-05-23.pdf',
      sent: new Date('2026-05-23T11:05:00Z'),
      sentById: opsUser.id,
    },
    {
      shDocumentId: shDoc6.id,
      to: ['cfernandez@granosdelsur.com.uy'],
      cc: ['admin@portlog.local'],
      subject: 'SH-66A Overtime — MV Hellas Carrier',
      key: 'sh-docs/nom4/sh66a-overtime-2026-06-08.pdf',
      sent: new Date('2026-06-08T23:30:00Z'),
      sentById: user3.id,
    },
    {
      shDocumentId: shDoc6.id,
      to: ['leriksen@nordicbulk.no'],
      cc: [],
      subject: 'SH-66A Overtime Copy — MV Hellas Carrier',
      key: 'sh-docs/nom4/sh66a-overtime-copy-2026-06-08.pdf',
      sent: new Date('2026-06-09T00:00:00Z'),
      sentById: user3.id,
    },
    {
      shDocumentId: shDoc9.id,
      to: ['pgimenez@rioplatense.com'],
      cc: ['ops@portlog.local'],
      subject: 'SH-28A Spare Parts — MV Liberian Star',
      key: 'sh-docs/nom5/sh28a-spares-2026-06-11.pdf',
      sent: new Date('2026-06-11T09:00:00Z'),
      sentById: user4.id,
    },
    {
      shDocumentId: shDoc9.id,
      to: ['gferreiro@patagoniamarine.com'],
      cc: [],
      subject: 'SH-28A Spare Parts Copy — MV Liberian Star',
      key: 'sh-docs/nom5/sh28a-spares-copy-2026-06-11.pdf',
      sent: new Date('2026-06-11T09:05:00Z'),
      sentById: user4.id,
    },
  ];

  // Extra dispatches to fill 10 total — reuse existing SH docs
  const shDoc1 = shDocSeeds[0]!;
  const extraDispatches = [
    {
      shDocumentId: shDoc1.id,
      to: ['ops@rioplatense.com'],
      cc: [],
      subject: 'Novedad — MV Patagonia Trader',
      key: 'sh-docs/nom2/comment-arrival-2026-05-22.pdf',
      sent: new Date('2026-05-22T16:00:00Z'),
      sentById: opsUser.id,
    },
    {
      shDocumentId: shDoc1.id,
      to: ['leriksen@nordicbulk.no'],
      cc: ['admin@portlog.local'],
      subject: 'Novedad Copy — MV Patagonia Trader',
      key: 'sh-docs/nom2/comment-arrival-copy-2026-05-22.pdf',
      sent: new Date('2026-05-22T16:10:00Z'),
      sentById: opsUser.id,
    },
    {
      shDocumentId: shDoc9.id,
      to: ['gferreiro@patagoniamarine.com'],
      cc: ['ops@portlog.local'],
      subject: 'SH-28A Spare Parts Follow-up',
      key: 'sh-docs/nom5/sh28a-spares-followup-2026-06-12.pdf',
      sent: new Date('2026-06-12T10:00:00Z'),
      sentById: user4.id,
    },
    {
      shDocumentId: shDoc6.id,
      to: ['ops@bunge.com.uy'],
      cc: [],
      subject: 'SH-66A Overtime Bunge Copy',
      key: 'sh-docs/nom4/sh66a-overtime-bunge-2026-06-09.pdf',
      sent: new Date('2026-06-09T08:00:00Z'),
      sentById: user3.id,
    },
  ];

  for (const d of [...shDispatchTargets, ...extraDispatches]) {
    await findOrCreate(
      () =>
        prisma.shDocumentDispatch.findFirst({
          where: { shDocumentId: d.shDocumentId, pdfStorageKey: d.key },
        }),
      () =>
        prisma.shDocumentDispatch.create({
          data: {
            shDocumentId: d.shDocumentId,
            toAddresses: d.to,
            ccAddresses: d.cc,
            subject: d.subject,
            pdfStorageKey: d.key,
            sentAt: d.sent,
            sentById: d.sentById,
          },
        }),
    );
  }
  console.log('Seeded 10 SH document dispatches');

  // ---------------------------------------------------------------------------
  // Fleet Vessels (10)
  // ---------------------------------------------------------------------------
  const fleetData = [
    { userId: opsUser.id, portUnlocode: 'UYMVD', imo: '9876543', name: 'MV Nordic Star' },
    { userId: opsUser.id, portUnlocode: 'UYMVD', imo: '9123456', name: 'MV Patagonia Trader' },
    { userId: opsUser.id, portUnlocode: 'UYNPA', imo: '9234567', name: 'MV Río Plata Spirit' },
    { userId: opsUser.id, portUnlocode: 'UYMVD', imo: '9345678', name: 'MV Hellas Carrier' },
    { userId: adminUser.id, portUnlocode: 'UYMVD', imo: '9876543', name: 'MV Nordic Star' },
    { userId: adminUser.id, portUnlocode: 'UYNPA', imo: '9456789', name: 'MV Liberian Star' },
    { userId: adminUser.id, portUnlocode: 'UYMVD', imo: '9567890', name: 'MV Bahamas Merchant' },
    { userId: user3.id, portUnlocode: 'UYMVD', imo: '9345678', name: 'MV Hellas Carrier' },
    { userId: user3.id, portUnlocode: 'UYNPA', imo: '9678901', name: 'MV Cyprus Bulker' },
    { userId: user4.id, portUnlocode: 'UYNPA', imo: '9456789', name: 'MV Liberian Star' },
  ];
  for (const f of fleetData) {
    await prisma.fleetVessel.upsert({
      where: {
        userId_portUnlocode_imo: { userId: f.userId, portUnlocode: f.portUnlocode, imo: f.imo },
      },
      update: {},
      create: f,
    });
  }
  console.log('Seeded 10 fleet vessels');

  // ---------------------------------------------------------------------------
  // Audit Logs (10)
  // ---------------------------------------------------------------------------
  const auditData = [
    {
      event: AuditEvent.LOGIN_SUCCESS,
      userId: adminUser.id,
      email: 'admin@portlog.local',
      ip: '192.168.1.10',
      userAgent: 'Mozilla/5.0',
    },
    {
      event: AuditEvent.LOGIN_SUCCESS,
      userId: opsUser.id,
      email: 'ops@portlog.local',
      ip: '192.168.1.11',
      userAgent: 'Mozilla/5.0',
    },
    {
      event: AuditEvent.LOGIN_SUCCESS,
      userId: user3.id,
      email: 'laura.gomez@portlog.local',
      ip: '192.168.1.12',
      userAgent: 'Chrome/120.0',
    },
    {
      event: AuditEvent.LOGIN_SUCCESS,
      userId: user4.id,
      email: 'martin.silva@portlog.local',
      ip: '192.168.1.13',
      userAgent: 'Chrome/120.0',
    },
    {
      event: AuditEvent.LOGIN_FAILURE,
      userId: null,
      email: 'unknown@hacker.com',
      ip: '203.0.113.99',
      userAgent: 'curl/7.85',
    },
    {
      event: AuditEvent.LOGOUT,
      userId: opsUser.id,
      email: 'ops@portlog.local',
      ip: '192.168.1.11',
      userAgent: 'Mozilla/5.0',
    },
    {
      event: AuditEvent.LOGIN_SUCCESS,
      userId: opsUser.id,
      email: 'ops@portlog.local',
      ip: '192.168.1.11',
      userAgent: 'Mozilla/5.0',
    },
    {
      event: AuditEvent.OWNER_FINANCIAL_DENIED,
      userId: opsUser.id,
      email: 'ops@portlog.local',
      ip: '192.168.1.11',
      userAgent: 'Mozilla/5.0',
      metadata: { ownerId: owner1.id, resource: 'Owner.agreements' },
    },
    {
      event: AuditEvent.REFRESH_TOKEN_REUSE,
      userId: adminUser.id,
      email: 'admin@portlog.local',
      ip: '10.0.0.5',
      userAgent: 'Mozilla/5.0',
      metadata: { suspicious: true },
    },
    {
      event: AuditEvent.LOGIN_FAILURE,
      userId: null,
      email: 'admin@portlog.local',
      ip: '203.0.113.50',
      userAgent: 'python-requests/2.28',
      metadata: { reason: 'Invalid password' },
    },
  ];
  for (const a of auditData) {
    await findOrCreate(
      () => prisma.auditLog.findFirst({ where: { event: a.event, email: a.email, ip: a.ip } }),
      () => prisma.auditLog.create({ data: a }),
    );
  }
  console.log('Seeded 10 audit logs');

  console.log('\n✓ Seed complete.');
  console.log('  ADM  admin@portlog.local / portlog_admin_dev');
  console.log('  OPS  ops@portlog.local / portlog_ops_dev');
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
