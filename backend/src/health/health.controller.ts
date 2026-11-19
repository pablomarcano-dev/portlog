import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @Public()
  check() {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  async ready() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const dependencies = Promise.all([
        this.prisma.$queryRaw`SELECT 1`,
        this.storage.isReady().then((ready) => {
          if (!ready) throw new Error('Storage unavailable');
        }),
      ]);
      await Promise.race([
        dependencies,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Readiness timeout')), 3000);
        }),
      ]);
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable' });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
