import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AttachmentsController } from './attachments.controller.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';

describe('attachment preview/download authorization', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  function context(user?: { role: string }): ExecutionContext {
    return {
      getHandler: () => AttachmentsController.prototype.download,
      getClass: () => AttachmentsController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  it('keeps the endpoint private for the global JWT guard', () => {
    expect(
      reflector.getAllAndOverride(IS_PUBLIC_KEY, [
        AttachmentsController.prototype.download,
        AttachmentsController,
      ]),
    ).not.toBe(true);
  });

  it.each(['OPS', 'ADM'])('allows authenticated %s operators to verify attachments', (role) => {
    expect(guard.canActivate(context({ role }))).toBe(true);
  });

  it('rejects absent or unauthorized users', () => {
    expect(() => guard.canActivate(context())).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context({ role: 'UNKNOWN' }))).toThrow(ForbiddenException);
  });
});
