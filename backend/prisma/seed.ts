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
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Find-or-create helper for entities without a unique natural key.
async function findOrCreate<T extends { id: string }>(
  findFn: () => Promise<T | null>,
  createFn: () => Promise<T>,
): Promise<T> {
  return (await findFn()) ?? (await createFn());
}

async function main(): Promise<void> {
  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@portlog.local' },
    update: {},
    create: {
      email: 'admin@portlog.local',
      passwordHash: await bcrypt.hash('portlog_admin_dev', 12),
      role: Role.ADM,
      isActive: true,
    },
  });
  console.log('Seeded ADM user:', adminUser.email);

  const opsUser = await prisma.user.upsert({
    where: { email: 'ops@portlog.local' },
    update: {},
    create: {
      email: 'ops@portlog.local',
      passwordHash: await bcrypt.hash('portlog_ops_dev', 10),
      role: Role.OPS,
      isActive: true,
    },
  });
  console.log('Seeded OPS user:', opsUser.email);

  // ---------------------------------------------------------------------------
  // Flags — unique on name, safe to upsert
  // ---------------------------------------------------------------------------
  const flagData = [
    { name: 'Uruguay', abbreviation: 'UY' },
    { name: 'Panama', abbreviation: 'PA' },
    { name: 'Liberia', abbreviation: 'LR' },
    { name: 'Marshall Islands', abbreviation: 'MH' },
    { name: 'Malta', abbreviation: 'MT' },
    { name: 'Bahamas', abbreviation: 'BS' },
    { name: 'Greece', abbreviation: 'GR' },
  ];

  const flags: Record<string, string> = {};
  for (const f of flagData) {
    const flag = await prisma.flag.upsert({
      where: { name: f.name },
      update: {},
      create: f,
    });
    flags[f.abbreviation] = flag.id;
  }
  console.log('Seeded flags:', Object.keys(flags).join(', '));

  // ---------------------------------------------------------------------------
  // Activities — unique on name
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
  ];
  for (const name of activityNames) {
    await prisma.activity.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log('Seeded activities');

  // ---------------------------------------------------------------------------
  // Cargoes — no unique field, use findFirst-or-create
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
  ];
  for (const c of cargoData) {
    await findOrCreate(
      () => prisma.cargo.findFirst({ where: { name: c.name } }),
      () => prisma.cargo.create({ data: c }),
    );
  }
  console.log('Seeded cargoes');

  // ---------------------------------------------------------------------------
  // Ports — no unique field, use findFirst-or-create
  // ---------------------------------------------------------------------------
  const mvdPort = await findOrCreate(
    () => prisma.port.findFirst({ where: { name: 'Puerto de Montevideo' } }),
    () =>
      prisma.port.create({
        data: {
          name: 'Puerto de Montevideo',
          abbreviation: 'MVD',
          location: 'Montevideo, Uruguay',
        },
      }),
  );
  const npPort = await findOrCreate(
    () => prisma.port.findFirst({ where: { name: 'Nueva Palmira' } }),
    () =>
      prisma.port.create({
        data: { name: 'Nueva Palmira', abbreviation: 'NPA', location: 'Colonia, Uruguay' },
      }),
  );
  await findOrCreate(
    () => prisma.port.findFirst({ where: { name: 'Fray Bentos' } }),
    () =>
      prisma.port.create({
        data: { name: 'Fray Bentos', abbreviation: 'FBT', location: 'Río Negro, Uruguay' },
      }),
  );
  const baPort = await findOrCreate(
    () => prisma.port.findFirst({ where: { name: 'Buenos Aires' } }),
    () =>
      prisma.port.create({
        data: { name: 'Buenos Aires', abbreviation: 'BUE', location: 'Buenos Aires, Argentina' },
      }),
  );
  console.log('Seeded ports: MVD, NPA, FBT, BUE');

  // ---------------------------------------------------------------------------
  // Operators — no unique field
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
          comments: 'Operador principal de graneles. Requiere copia en todos los despachos.',
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
  console.log('Seeded operators');

  // ---------------------------------------------------------------------------
  // Owners — no unique field
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
          notes: 'Cliente desde 2018. Requiere siempre NOR inmediato al fondear.',
          agreements: 'Tarifa fija USD 4,500 por escala. Revisable anualmente.',
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
  console.log('Seeded owners');

  // ---------------------------------------------------------------------------
  // Charterers — no unique field
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
  console.log('Seeded charterers');

  // ---------------------------------------------------------------------------
  // Shippers — no unique field
  // ---------------------------------------------------------------------------
  const sh1 = await findOrCreate(
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
  console.log('Seeded shippers');

  // ---------------------------------------------------------------------------
  // Agents — no unique field
  // ---------------------------------------------------------------------------
  const agent1 = await findOrCreate(
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
  console.log('Seeded agents');

  // ---------------------------------------------------------------------------
  // Suppliers — no unique field
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
  ];
  for (const s of suppliersData) {
    await findOrCreate(
      () => prisma.supplier.findFirst({ where: { name: s.name } }),
      () => prisma.supplier.create({ data: s }),
    );
  }
  console.log('Seeded suppliers');

  // ---------------------------------------------------------------------------
  // Contacts — no unique field
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
  console.log('Seeded contacts');

  // ---------------------------------------------------------------------------
  // Ship Particulars — unique on callSign
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
  console.log('Seeded ship particulars: Nordic Star, Patagonia Trader, Río Plata Spirit');

  // ---------------------------------------------------------------------------
  // Email Groups — no unique field
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
  console.log('Seeded email groups');

  // ---------------------------------------------------------------------------
  // Nominations — unique on correlative
  // ---------------------------------------------------------------------------
  const nom1 = await prisma.nomination.upsert({
    where: { correlative: 1 },
    update: {},
    create: {
      voyageNumber: '001/MVD',
      voyageCode: 'GRA',
      shipParticularId: vessel1.id,
      opPortId: mvdPort.id,
      berthPortId: mvdPort.id,
      lastPortId: baPort.id,
      nextPortId: baPort.id,
      operatorId: op1.id,
      ownerId: owner1.id,
      charterId: ch1.id,
      shipperId: sh1.id,
      agentId: agent1.id,
      dateNominated: new Date('2026-05-20T10:00:00Z'),
      etaDate: new Date('2026-05-28T06:00:00Z'),
      nominationType: NominationType.FULL_AGENCY,
      status: NominationStatus.DRAFT,
      nominatedById: opsUser.id,
      master: 'Capt. John Anderson',
      features: [{ product: 'Soja', qtty: '25000', unit: 'MT', oper: 'Carga' }],
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
      berthPortId: mvdPort.id,
      lastPortId: npPort.id,
      operatorId: op2.id,
      ownerId: owner2.id,
      charterId: ch2.id,
      dateNominated: new Date('2026-05-15T08:00:00Z'),
      etaDate: new Date('2026-05-22T14:00:00Z'),
      nominationType: NominationType.FULL_AGENCY,
      status: NominationStatus.IN_PROGRESS,
      nominatedById: opsUser.id,
      master: 'Capt. María García',
      features: [{ product: 'Trigo', qtty: '60000', unit: 'MT', oper: 'Descarga' }],
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
      berthPortId: npPort.id,
      dateNominated: new Date('2026-05-22T09:00:00Z'),
      etaDate: new Date('2026-06-01T10:00:00Z'),
      nominationType: NominationType.OWNERS_AGENTS_ONLY,
      status: NominationStatus.CONFIRMED,
      master: 'Capt. Roberto Silva',
      features: [{ product: 'Celulosa', qtty: '10000', unit: 'MT', oper: 'Carga' }],
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
  console.log('Seeded nominations: nom1 (DRAFT), nom2 (IN_PROGRESS), nom3 (CONFIRMED)');

  // ---------------------------------------------------------------------------
  // PEDR — Nomination 2, stage ATTENDING
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

  // Sub-documents — use real UUIDs
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
  ];
  for (const s of subDocSeeds) {
    await prisma.pedrSubDocument.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, pedrId: pedr.id, createdById: opsUser.id },
    });
  }

  // Events
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
  ];
  for (const ev of pedrEvents) {
    const exists = await prisma.pedrEvent.findFirst({ where: { pedrId: pedr.id, kind: ev.kind } });
    if (!exists)
      await prisma.pedrEvent.create({ data: { ...ev, pedrId: pedr.id, recordedById: opsUser.id } });
  }

  // Email dispatches
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
  console.log('Seeded PEDR for nom2: stage ATTENDING, 4 sub-docs, 4 events, 3 dispatches');

  // ---------------------------------------------------------------------------
  // SH Documents — real UUIDs required
  // ---------------------------------------------------------------------------
  const shDocSeeds = [
    {
      id: '00000000-0000-0000-0001-000000000001',
      nominationId: nom2.id,
      type: SHDocumentType.COMMENT,
      status: SHDocumentStatus.DRAFT,
      data: {
        type: 'COMMENT',
        html: 'Buque llegó con retraso por mal tiempo en el estuario. Capitán solicitó cambio de tripulación urgente.',
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
        rows: [
          { date: '2026-05-22', from: '20:00', to: '23:00', activity: 'Atraque nocturno' },
          {
            date: '2026-05-23',
            from: '05:00',
            to: '08:00',
            activity: 'Inicio descarga anticipada',
          },
        ],
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
        body: 'Se garantiza atención médica para el tripulante arriba mencionado en clínica autorizada por el armador.',
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
        rows: [
          { description: 'Bomba hidráulica de repuesto', qty: 1, unit: 'pcs', weightKg: 45 },
          { description: 'Kit de sellos para motor auxiliar', qty: 3, unit: 'pcs', weightKg: 2.5 },
        ],
      },
    },
    {
      id: '00000000-0000-0000-0001-000000000005',
      nominationId: nom1.id,
      type: SHDocumentType.COMMENT,
      status: SHDocumentStatus.DRAFT,
      data: { type: 'COMMENT', html: 'Nominación recibida. Pendiente confirmación ETA.' },
    },
  ];
  for (const doc of shDocSeeds) {
    await prisma.sHDocument.upsert({
      where: { id: doc.id },
      update: {},
      create: { ...doc, createdById: opsUser.id },
    });
  }
  console.log('Seeded SH documents for nom1 (1 doc) and nom2 (4 docs)');

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
