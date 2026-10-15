import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { from } from 'rxjs';
import { EmailDeliveryService } from './email-delivery.service.js';

@Injectable()
export class EmailSendInterceptor implements NestInterceptor {
  constructor(private readonly delivery: EmailDeliveryService) {}
  intercept(context: ExecutionContext, next: CallHandler): ReturnType<CallHandler['handle']> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user: { sub: string };
      url: string;
      body: unknown;
    }>();
    const reply = context
      .switchToHttp()
      .getResponse<{ statusCode: number; code: (status: number) => void }>();
    return from(
      this.delivery
        .run(
          req.headers['idempotency-key'] ?? '',
          req.user.sub,
          req.url,
          req.body ?? null,
          () =>
            new Promise<unknown>((resolve, reject) => {
              let body: unknown;
              next.handle().subscribe({
                next: (value: unknown) => {
                  body = value;
                },
                error: reject,
                complete: () => resolve({ body: body ?? null, statusCode: reply.statusCode }),
              });
            }),
        )
        .then((result) => {
          const saved = result as { body: unknown; statusCode: number };
          reply.code(saved.statusCode);
          return saved.body ?? undefined;
        }),
    ) as unknown as ReturnType<CallHandler['handle']>; // Nest and workspace resolve separate RxJS type copies.
  }
}
