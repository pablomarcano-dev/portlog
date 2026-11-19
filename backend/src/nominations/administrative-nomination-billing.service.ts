import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdministrativeBillingCategory,
  AdministrativeBillingRecipient,
  AdministrativeBillingRecipients,
  AdministrativeBillingUpdate,
} from '@portlog/schemas';
import { PrismaService } from '../prisma/prisma.service.js';

const recipientSelect = {
  clientId: true,
  clientName: true,
  addressPurpose: true,
  addressText: true,
} as const;

@Injectable()
export class AdministrativeNominationBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getByNomination(nominationId: string): Promise<AdministrativeBillingRecipients> {
    const nomination = await this.prisma.nomination.findUnique({
      where: { id: nominationId },
      select: {
        administrativeBillingRecipients: { select: { category: true, ...recipientSelect } },
      },
    });
    if (!nomination) throw new NotFoundException('Nomination not found.');

    const recipients: AdministrativeBillingRecipients = {
      PORT_COSTS: null,
      OWNER_EXPENSES: null,
      TECHNICAL_MANAGEMENT: null,
    };
    for (const { category, ...recipient } of nomination.administrativeBillingRecipients) {
      recipients[category] = recipient;
    }
    return recipients;
  }

  async setRecipient(
    nominationId: string,
    category: AdministrativeBillingCategory,
    { selection }: AdministrativeBillingUpdate,
  ): Promise<AdministrativeBillingRecipient | null> {
    return this.prisma.$transaction(async (tx) => {
      // Serialize with cancellation without changing the nomination's own fields.
      const [nomination] = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status"::text AS "status"
        FROM "nominations"
        WHERE "id" = ${nominationId}::uuid
        FOR NO KEY UPDATE
      `;
      if (!nomination) throw new NotFoundException('Nomination not found.');
      if (nomination.status === 'CANCELLED') {
        throw new ConflictException('Nomination is cancelled and cannot be updated.');
      }

      const where = { nominationId, category };
      if (!selection) {
        await tx.administrativeNominationBillingRecipient.deleteMany({ where });
        return null;
      }

      const client = await tx.client.findUnique({
        where: { id: selection.clientId },
        select: {
          name: true,
          addresses: {
            where: { purpose: selection.addressPurpose, text: selection.addressText },
            select: { text: true },
            take: 1,
          },
        },
      });
      const address = client?.addresses[0];
      if (!client || !address) {
        throw new ConflictException('The selected billing address changed. Select it again.');
      }

      const recipient: AdministrativeBillingRecipient = {
        clientId: selection.clientId,
        clientName: client.name,
        addressPurpose: selection.addressPurpose,
        addressText: address.text,
      };
      return tx.administrativeNominationBillingRecipient.upsert({
        where: { nominationId_category: where },
        create: { ...where, ...recipient },
        update: recipient,
        select: recipientSelect,
      });
    });
  }
}
