import { Injectable, NotFoundException } from '@nestjs/common';
import { ordinalDay } from '@portlog/schemas';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdministrativeNominationInstructionsDocxService } from './administrative-nomination-instructions-docx.service.js';
import { formatNominationNoticeReference, formatSnOt } from './nomination-reference.js';

const clientInstructions = {
  administrativePortCostInstructions: true,
  administrativeOwnerExpensesInstructions: true,
  administrativeTechnicalManagementInstructions: true,
} as const;

const arrivalDayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Caracas',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatArrivalDay(eta: Date | null): string {
  if (!eta) return '';
  const parts = arrivalDayFormatter.formatToParts(eta);
  const month = parts.find(({ type }) => type === 'month')?.value;
  const day = parts.find(({ type }) => type === 'day')?.value;
  const year = parts.find(({ type }) => type === 'year')?.value;
  return `${month} ${ordinalDay(Number(day))}, ${year}`.toUpperCase();
}

@Injectable()
export class AdministrativeNominationInstructionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docx: AdministrativeNominationInstructionsDocxService,
  ) {}

  async generate(nominationId: string): Promise<{ buffer: Buffer; filename: string }> {
    const nomination = await this.prisma.nomination.findUnique({
      where: { id: nominationId },
      select: {
        correlative: true,
        dateNominated: true,
        kind: true,
        administrativeSnOt: true,
        etaDate: true,
        grt: true,
        sdwt: true,
        loa: true,
        branch: { select: { code: true } },
        pedr: { select: { etaRecord: { select: { etaNotify: true } } } },
        opPort: { select: { name: true, municipality: true } },
        client: { select: clientInstructions },
        charterer: { select: clientInstructions },
        shipParticular: {
          select: {
            name: true,
            imoNumber: true,
            grt: true,
            dwt: true,
            loa: true,
            flag: { select: { name: true } },
          },
        },
        administrativeBillingRecipients: {
          select: { category: true, clientName: true, addressText: true },
        },
      },
    });

    if (!nomination) throw new NotFoundException('Nomination not found');

    const client = nomination.client ?? nomination.charterer;
    const vessel = nomination.shipParticular;
    const loa = nomination.loa ?? vessel.loa;
    const billing = new Map(
      nomination.administrativeBillingRecipients.map(({ category, clientName, addressText }) => [
        category,
        `${clientName}\n${addressText}`,
      ]),
    );
    const filenameReference =
      nomination.administrativeSnOt ??
      formatSnOt(nomination.correlative, nomination.dateNominated, nomination.kind);

    const buffer = this.docx.render({
      snOt:
        nomination.administrativeSnOt ??
        formatNominationNoticeReference(
          nomination.correlative,
          nomination.dateNominated,
          nomination.kind,
          nomination.branch?.code ?? null,
        ),
      vessel: vessel.name,
      arrivalDay: formatArrivalDay(nomination.pedr?.etaRecord?.etaNotify ?? nomination.etaDate),
      operationPort: nomination.opPort?.name ?? '',
      portCostInstructions: client?.administrativePortCostInstructions ?? '',
      ownerExpensesInstructions: client?.administrativeOwnerExpensesInstructions ?? '',
      technicalManagementInstructions: client?.administrativeTechnicalManagementInstructions ?? '',
      imo: vessel.imoNumber ?? '',
      grt: (nomination.grt ?? vessel.grt)?.toString() ?? '',
      flag: vessel.flag.name,
      dwt: (nomination.sdwt ?? vessel.dwt)?.toString() ?? '',
      loa: loa?.toFixed(Math.max(2, loa.decimalPlaces())) ?? '',
      municipality: nomination.opPort?.municipality ?? '',
      portCostsBilling: billing.get('PORT_COSTS') ?? '',
      ownerExpensesBilling: billing.get('OWNER_EXPENSES') ?? '',
      technicalManagementBilling: billing.get('TECHNICAL_MANAGEMENT') ?? '',
    });

    return {
      buffer,
      filename: `${filenameReference.replaceAll('/', '-')}-administrative-nomination-instructions.docx`,
    };
  }
}
