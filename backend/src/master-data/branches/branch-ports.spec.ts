import { BranchesService } from './branches.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
function setup() {
  const prisma = {
    branch: { findUnique: jest.fn().mockResolvedValue({ id: 'branch' }) },
    port: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { prisma, service: new BranchesService(prisma as unknown as PrismaService) };
}
describe('branch-side port associations', () => {
  it('uses the same Port.branchId relation as port maintenance and filters', async () => {
    const f = setup();
    await f.service.assignPort('new-branch', 'port', 'old-branch');
    expect(f.prisma.port.updateMany).toHaveBeenCalledWith({
      where: { id: 'port', branchId: 'old-branch' },
      data: { branchId: 'new-branch' },
    });
    expect(f.prisma.port.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { branchId: 'new-branch' } }),
    );
  });
  it('rejects a stale assignment rather than overwriting another user change', async () => {
    const f = setup();
    f.prisma.port.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.service.assignPort('branch', 'port', null)).rejects.toThrow(
      'assignment changed',
    );
  });
  it('removes only the association on this branch, never the port record', async () => {
    const f = setup();
    await f.service.unassignPort('branch', 'port');
    expect(f.prisma.port.updateMany).toHaveBeenCalledWith({
      where: { id: 'port', branchId: 'branch' },
      data: { branchId: null },
    });
  });
});
