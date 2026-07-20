import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

// Nominations are considered stale for ETA/ETB when either:
// - No ETA_ETB dispatch has ever been sent for their PEDR, or
// - The last ETA_ETB dispatch was sent more than ETA_STALE_HOURS ago.
const ETA_STALE_HOURS = 15;

@Injectable()
export class EtaAlertCron {
  private readonly logger = new Logger(EtaAlertCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkStaleEtaDispatches(): Promise<void> {
    this.logger.log({ event: 'eta-alert.cron.start' });

    const staleThreshold = new Date(Date.now() - ETA_STALE_HOURS * 60 * 60 * 1000);

    // Active = nomination not cancelled and vessel not yet departed (no final SOF
    // sent). Once the final SOF goes out the nomination is FULL_AWAY and no longer
    // needs ETA/ETB chasing.
    const activePedrs = await this.prisma.pedr.findMany({
      where: {
        nomination: { status: { not: 'CANCELLED' } },
        emailDispatches: { none: { subDocType: 'SOF', sentAt: { not: null } } },
      },
      select: {
        id: true,
        emailDispatches: {
          where: { subDocType: 'ETA_ETB' },
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: { sentAt: true },
        },
      },
    });

    const flaggedIds: string[] = [];

    for (const pedr of activePedrs) {
      const lastDispatch = pedr.emailDispatches[0];
      const lastSentAt = lastDispatch?.sentAt ?? null;

      const isStale = lastSentAt === null || lastSentAt < staleThreshold;

      if (isStale) {
        flaggedIds.push(pedr.id);

        this.logger.warn({
          event: 'eta-alert.stale',
          pedrId: pedr.id,
          etaLastSent: lastSentAt?.toISOString() ?? null,
          thresholdHours: ETA_STALE_HOURS,
        });

        await this.prisma.pedr.update({
          where: { id: pedr.id },
          data: {
            metadata: {
              etaStaleAlert: true,
              etaLastSent: lastSentAt?.toISOString() ?? null,
            },
          },
        });
      } else {
        // Clear stale flag if a recent dispatch exists
        await this.prisma.pedr.update({
          where: { id: pedr.id },
          data: {
            metadata: {
              etaStaleAlert: false,
              etaLastSent: lastSentAt?.toISOString() ?? null,
            },
          },
        });
      }
    }

    this.logger.log({
      event: 'eta-alert.cron.done',
      checked: activePedrs.length,
      flagged: flaggedIds.length,
    });
  }
}
