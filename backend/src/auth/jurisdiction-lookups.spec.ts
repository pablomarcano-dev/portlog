import { PortsController } from '../master-data/ports/ports.controller.js';
import type { PortsService } from '../master-data/ports/ports.service.js';
import { ShipParticularsService } from '../master-data/ship-particulars/ship-particulars.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RequestUser } from './jwt.strategy.js';

const user: RequestUser = {
  sub: 'agent',
  email: 'a@example.test',
  role: 'OPS',
  permissions: [],
  branchId: 'plc',
};
describe('branch jurisdiction lookup boundaries', () => {
  it('uses the selected agent branch despite a supplied branch filter', () => {
    const list = jest.fn();
    const controller = new PortsController({ list } as unknown as PortsService);
    controller.list({ limit: 50, branchId: 'other' }, { user });
    expect(list).toHaveBeenCalledWith({ limit: 50, branchId: 'plc' });
  });
  it('retains global Last/Next Port lookup explicitly', () => {
    const list = jest.fn();
    const controller = new PortsController({ list } as unknown as PortsService);
    controller.list({ limit: 50 }, { user }, 'true');
    expect(list).toHaveBeenCalledWith({ limit: 50 });
  });
  it('scopes vessel page/count/search and direct IDs through branch nominations', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const findUnique = jest.fn().mockResolvedValue(null);
    const service = new ShipParticularsService({
      shipParticular: { findMany, findUnique },
    } as unknown as PrismaService);
    await service.list({ limit: 50 }, 'plc');
    await service.search('vessel', 'plc');
    for (const [query] of findMany.mock.calls)
      expect(query.where.nominations).toEqual({ some: { branchId: 'plc' } });
    await expect(service.getById('hidden', 'plc')).rejects.toThrow();
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'hidden', nominations: { some: { branchId: 'plc' } } },
      }),
    );
  });
});
