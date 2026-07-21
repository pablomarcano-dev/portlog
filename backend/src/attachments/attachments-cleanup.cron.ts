import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

// Attachments uploaded but never sent (a compose that was cancelled) stay
// "staged" — both dispatch links null. Purge them after this TTL so MinIO
// objects and rows don't accumulate. Generous window: a real compose session
// is minutes, not hours.
const STAGED_TTL_MS = 24 * 60 * 60 * 1000; // 24h

@Injectable()
export class AttachmentsCleanupCron {
  private readonly logger = new Logger(AttachmentsCleanupCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeStaged(): Promise<void> {
    const cutoff = new Date(Date.now() - STAGED_TTL_MS);
    const stale = await this.prisma.emailAttachment.findMany({
      where: {
        emailDispatchId: null,
        shDocumentDispatchId: null,
        createdAt: { lt: cutoff },
      },
      select: { id: true, minioKey: true },
    });
    if (!stale.length) return;

    let purged = 0;
    for (const row of stale) {
      // Re-check the null links inside the delete so we never remove an
      // attachment that got linked to a dispatch between the read and now.
      const { count } = await this.prisma.emailAttachment.deleteMany({
        where: { id: row.id, emailDispatchId: null, shDocumentDispatchId: null },
      });
      if (count !== 1) continue;
      purged += 1;
      try {
        await this.storage.deleteFile(row.minioKey);
      } catch (err) {
        this.logger.warn({ event: 'attachment.cleanup.storage.warn', id: row.id, err });
      }
    }

    if (purged > 0) this.logger.log({ event: 'attachment.cleanup', purged });
  }
}
