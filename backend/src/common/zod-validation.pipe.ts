import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema, ZodError } from 'zod';

/**
 * ZodValidationPipe — thin NestJS pipe that validates a value against a Zod schema.
 *
 * Usage (on a controller param):
 *   @Query(new ZodValidationPipe(FlagListQuerySchema)) query: FlagListQuery
 *
 * For body DTOs, prefer `createZodDto` from nestjs-zod on the DTO class itself —
 * nestjs-zod's global ZodValidationPipe (registered in AppModule) handles those
 * automatically. This pipe is for @Query() and @Param() validation where a class-based
 * DTO is impractical.
 *
 * Golden Rule 2: all inbound data is validated by the canonical Zod schema from
 * @portlog/schemas — never duplicate validation logic here.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const err = result.error as ZodError;
      throw new BadRequestException({
        message: 'Validation failed',
        errors: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    return result.data;
  }
}
