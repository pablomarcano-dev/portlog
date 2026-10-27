import { PublicNominationsService } from './public-nominations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const timestamp = new Date('2026-10-27T19:43:00.000Z');
const row = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  correlative: 22,
  dateNominated: timestamp,
  kind: 'SN',
  status: 'NOMINATED',
  nominationType: 'FULL_AGENCY',
  voyageNumber: '1',
  voyageCode: null,
  shipParticular: { name: 'Vessel', callSign: 'ABC', imoNumber: null },
  opPort: null,
  etaDate: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  layDaysFirst: null,
  layDaysLast: null,
  pedr: null,
  client: null,
  pier: null,
  lastPort: null,
  nextPort: null,
  disPort: null,
  nomReply: null,
  master: null,
  broker: null,
  boardingClerk: null,
  inspector: null,
  subject: null,
  referenceNo: null,
  parcels: [],
  nominationClients: [],
};

describe('public sailing date', () => {
  const nomination = { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() };
  const service = new PublicNominationsService({ nomination } as unknown as PrismaService);

  it.each([
    [{ entries: [{ occurredAt: timestamp }] }, timestamp.toISOString()],
    [{ entries: [] }, null],
    [null, null],
  ])('exposes the SOF date or null in list and detail (%j)', async (sofTimesheet, expected) => {
    nomination.findMany.mockResolvedValue([{ ...row, sofTimesheet }]);
    nomination.count.mockResolvedValue(1);
    nomination.findUnique.mockResolvedValue({ ...row, sofTimesheet });
    const list = await service.list({ page: 1, pageSize: 25, sort: '-updatedAt' });
    const detail = await service.byId(row.id);
    expect(list.data[0].sailedAt).toBe(expected);
    expect(detail.data.dates.sailedAt).toBe(expected);
  });

  it('selects only the last matching activity in SOF order for both endpoints', async () => {
    const expected = {
      select: {
        entries: {
          where: { activity: { name: { equals: 'Sailed Full Away', mode: 'insensitive' } } },
          orderBy: [{ order: 'desc' }, { occurredAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { occurredAt: true },
        },
      },
    };
    for (const method of [nomination.findMany, nomination.findUnique]) {
      expect(method).toHaveBeenLastCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ sofTimesheet: expected }),
        }),
      );
    }
  });
});
