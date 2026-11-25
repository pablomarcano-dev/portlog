import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AdministrativeInstructionDiagnosticsSchema,
  ordinalDay,
  type AdministrativeInstructionDiagnostics,
} from '@portlog/schemas';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdministrativeNominationInstructionsDocxService } from './administrative-nomination-instructions-docx.service.js';
import { resolveNominationReference } from '@portlog/schemas';

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

  private async load(nominationId: string) {
    const nomination = await this.prisma.nomination.findUnique({
      where: { id: nominationId },
      select: {
        correlative: true,
        dateNominated: true,
        kind: true,
        administrativeSnOt: true,
        businessReference: true,
        etaDate: true,
        grt: true,
        sdwt: true,
        loa: true,
        branch: { select: { code: true } },
        pedr: { select: { etaRecord: { select: { etaNotify: true } } } },
        opPort: { select: { name: true, municipality: true } },
        client: { select: { name: true, ...clientInstructions } },
        charterer: { select: { name: true, ...clientInstructions } },
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
    return nomination;
  }

  async diagnostics(nominationId: string): Promise<AdministrativeInstructionDiagnostics> {
    const nomination = await this.load(nominationId);
    // Match export precedence: a selected instruction client wins even when its
    // optional instructions are blank. Never substitute another client's rules.
    const client = nomination.client ?? nomination.charterer;
    const populated = (value: string | null | undefined) =>
      value?.trim() ? ('POPULATED' as const) : ('MISSING' as const);
    const billing = (category: string) => {
      const row = nomination.administrativeBillingRecipients.find(
        (recipient) => recipient.category === category,
      );
      if (!row) return 'MISSING' as const;
      return row.clientName.trim() && row.addressText.trim()
        ? ('POPULATED' as const)
        : ('INCOMPLETE' as const);
    };
    return AdministrativeInstructionDiagnosticsSchema.parse({
      instructionSource: nomination.client
        ? 'INSTRUCTION_CLIENT'
        : nomination.charterer
          ? 'CHARTERER_FALLBACK'
          : 'NONE',
      instructionClientName: client?.name ?? null,
      checks: [
        {
          field: 'PORT_COSTS_INSTRUCTIONS',
          status: populated(client?.administrativePortCostInstructions),
        },
        {
          field: 'OWNER_EXPENSES_INSTRUCTIONS',
          status: populated(client?.administrativeOwnerExpensesInstructions),
        },
        {
          field: 'TECHNICAL_MANAGEMENT_INSTRUCTIONS',
          status: populated(client?.administrativeTechnicalManagementInstructions),
        },
        { field: 'PORT_MUNICIPALITY', status: populated(nomination.opPort?.municipality) },
        { field: 'PORT_COSTS_BILLING', status: billing('PORT_COSTS') },
        { field: 'OWNER_EXPENSES_BILLING', status: billing('OWNER_EXPENSES') },
        { field: 'TECHNICAL_MANAGEMENT_BILLING', status: billing('TECHNICAL_MANAGEMENT') },
      ],
    });
  }

  async generate(nominationId: string): Promise<{ buffer: Buffer; filename: string }> {
    const nomination = await this.load(nominationId);
    const client = nomination.client ?? nomination.charterer;
    const vessel = nomination.shipParticular;
    const loa = nomination.loa ?? vessel.loa;
    const billing = new Map(
      nomination.administrativeBillingRecipients.map(({ category, clientName, addressText }) => [
        category,
        `${clientName}\n${addressText}`,
      ]),
    );
    const filenameReference = resolveNominationReference(nomination);

    const buffer = this.docx.render({
      snOt: resolveNominationReference(nomination, 'notice'),
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
