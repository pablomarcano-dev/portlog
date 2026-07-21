import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  PayloadTooLargeException,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { AttachmentsService } from './attachments.service.js';
import { Roles } from '../auth/roles.decorator.js';
import type { RequestUser } from '../auth/jwt.strategy.js';

// @fastify/multipart decorates the request with these at runtime. We type them
// explicitly (rather than relying on the plugin's module augmentation, which
// doesn't resolve reliably through NestJS's fastify re-export) and cast.
interface MultipartRequest {
  isMultipart(): boolean;
  file(): Promise<MultipartFile | undefined>;
}

type AuthedRequest = FastifyRequest & { user: RequestUser };

@Controller('attachments')
@Roles('OPS', 'ADM')
export class AttachmentsController {
  constructor(private readonly svc: AttachmentsService) {}

  /**
   * POST /api/attachments — multipart/form-data, one file per request.
   * Stores the file in MinIO and returns its EmailAttachment id + metadata.
   */
  @Post()
  async upload(@Req() req: AuthedRequest) {
    const mreq = req as unknown as MultipartRequest;
    if (!mreq.isMultipart()) {
      throw new BadRequestException('Expected multipart/form-data');
    }

    const data = await mreq.file();
    if (!data) throw new BadRequestException('No file provided');

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch {
      // @fastify/multipart aborts the stream and throws once fileSize is exceeded.
      throw new PayloadTooLargeException('File exceeds the maximum allowed size');
    }

    return this.svc.upload(
      { filename: data.filename, mimeType: data.mimetype, buffer },
      req.user.sub,
    );
  }

  /** DELETE /api/attachments/:id — remove a staged (not-yet-sent) attachment. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.svc.delete(id, req.user.sub);
  }

  /** GET /api/attachments/:id/download — stream the file back to the browser. */
  @Get(':id/download')
  async download(@Param('id') id: string, @Res() reply: FastifyReply) {
    const file = await this.svc.getForDownload(id);
    const asciiName = file.filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    await reply
      .header('Content-Type', file.contentType)
      .header(
        'Content-Disposition',
        `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      )
      .send(file.content);
  }
}
