import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hasManagementAccess } from '@portlog/schemas';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RequestUser } from './jwt.strategy.js';

/** Applied after JWT/role guards, before validation strips unknown body fields. */
@Injectable()
export class OperationalAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: RequestUser;
      method: string;
      url: string;
      params: Record<string, string>;
      body?: Record<string, unknown>;
    }>();
    if (!req.user || hasManagementAccess(req.user)) return true;
    const path = req.url.split('?')[0]!.replace(/^\/api(?=\/)/, '');
    const method = req.method.toUpperCase();
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (path.startsWith('/master-data/') && write) this.deny();
    // Read-only operational lookups remain available; the full Clients directory is management.
    if (path === '/master-data/clients' || path.startsWith('/master-data/clients/')) this.deny();
    if (path === '/nominations' && method === 'POST') this.deny();
    if (/^\/nominations\/[^/]+\/(clients|administrative-billing)(\/|$)/.test(path)) this.deny();
    if (/^\/nominations\/[^/]+\/parcels$/.test(path) && write) this.deny();
    if (/^\/nominations\/[^/]+$/.test(path) && method === 'PATCH') {
      const allowed = new Set(['lastPortId', 'nextPortId', 'boardingClerk']);
      if (Object.keys(req.body ?? {}).some((key) => !allowed.has(key))) {
        throw new ForbiddenException('Agents can edit only Last Port, Next Port and Boarding.');
      }
      if (typeof req.body?.['boardingClerk'] === 'string' && req.body['boardingClerk']) {
        const existing = await this.prisma.nomination.findUnique({
          where: { id: req.params['id'] },
          select: { boardingClerk: true },
        });
        if (req.body['boardingClerk'] !== existing?.boardingClerk) {
          const agent = await this.prisma.agent.findFirst({
            where: {
              name: req.body['boardingClerk'],
              branchId: req.user.branchId ?? '__unassigned__',
            },
            select: { id: true },
          });
          if (!agent)
            throw new BadRequestException('Select a boarding agent assigned to your branch.');
        }
      }
      if (!Object.keys(req.body ?? {}).length)
        throw new BadRequestException('No changes supplied.');
    }

    if (path.startsWith('/attachments/') && req.params['id']) {
      const attachment = await this.prisma.emailAttachment.findUnique({
        where: { id: req.params['id'] },
        select: {
          uploadedById: true,
          emailDispatch: {
            select: { pedr: { select: { nomination: { select: { branchId: true } } } } },
          },
          shDocumentDispatch: {
            select: { shDocument: { select: { nomination: { select: { branchId: true } } } } },
          },
          serviceRequest: { select: { branchId: true } },
          serviceRequestDispatch: { select: { serviceRequest: { select: { branchId: true } } } },
          terminalPort: { select: { branchId: true } },
        },
      });
      if (!attachment) throw new NotFoundException('Attachment not found.');
      const branches = [
        attachment.emailDispatch?.pedr?.nomination.branchId,
        attachment.shDocumentDispatch?.shDocument.nomination.branchId,
        attachment.serviceRequest?.branchId,
        attachment.serviceRequestDispatch?.serviceRequest.branchId,
        attachment.terminalPort?.branchId,
      ].filter((value): value is string => typeof value === 'string');
      if (
        branches.length
          ? !req.user.branchId || !branches.includes(req.user.branchId)
          : attachment.uploadedById !== req.user.sub
      )
        this.deny();
    }

    let nominationId = req.params['nominationId'];
    if (!nominationId && path.startsWith('/nominations/')) nominationId = req.params['id'];
    if (!nominationId && path === '/pedr' && method === 'POST') {
      nominationId =
        typeof req.body?.['nominationId'] === 'string' ? req.body['nominationId'] : undefined;
    }
    const pedrId =
      req.params['pedrId'] ?? (path.startsWith('/pedr/') ? req.params['id'] : undefined);
    if (!nominationId && pedrId) {
      const pedr = await this.prisma.pedr.findUnique({
        where: { id: pedrId },
        select: { nominationId: true },
      });
      if (!pedr) throw new NotFoundException('PEDR not found.');
      nominationId = pedr.nominationId;
    }
    if (nominationId) {
      const nomination = await this.prisma.nomination.findUnique({
        where: { id: nominationId },
        select: { branchId: true },
      });
      if (!nomination) throw new NotFoundException('Nomination not found.');
      if (!req.user.branchId || nomination.branchId !== req.user.branchId) this.deny();
    }
    return true;
  }

  private deny(): never {
    throw new ForbiddenException('This operation is outside your authorized access.');
  }
}
