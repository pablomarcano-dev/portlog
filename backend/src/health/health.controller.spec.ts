import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { StorageService } from '../storage/storage.service.js';

describe('Readiness', () => {
  const query = jest.fn();
  const storage = jest.fn();
  const controller = new HealthController(
    { $queryRaw: query } as unknown as PrismaService,
    { isReady: storage } as unknown as StorageService,
  );
  beforeEach(() => {
    query.mockResolvedValue([{ value: 1 }]);
    storage.mockResolvedValue(true);
  });
  it('requires both database and object storage', async () => {
    await expect(controller.ready()).resolves.toEqual({ status: 'ok' });
  });
  it('fails when the configured bucket is unavailable', async () => {
    storage.mockResolvedValue(false);
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('does not expose database connection errors', async () => {
    query.mockRejectedValue(new Error('private connection diagnostic'));
    await expect(controller.ready()).rejects.toMatchObject({ response: { status: 'unavailable' } });
  });
});
