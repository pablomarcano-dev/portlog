import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'INVALID_QUERY',
  [HttpStatus.UNAUTHORIZED]: 'INVALID_API_KEY',
  [HttpStatus.FORBIDDEN]: 'API_KEY_DISABLED',
  [HttpStatus.NOT_FOUND]: 'NOMINATION_NOT_FOUND',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMIT_EXCEEDED',
};

@Catch()
export class PublicApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const response = exception instanceof HttpException ? exception.getResponse() : null;
    const responseMessage =
      typeof response === 'object' && response !== null && 'message' in response
        ? (response as { message?: unknown }).message
        : null;
    const message =
      status >= 500
        ? 'An unexpected error occurred.'
        : typeof responseMessage === 'string'
          ? responseMessage
          : exception instanceof Error
            ? exception.message
            : 'Request failed.';

    void reply.status(status).send({
      error: {
        code: CODE_BY_STATUS[status] ?? 'INTERNAL_ERROR',
        message,
        requestId: String(request.id),
      },
    });
  }
}
