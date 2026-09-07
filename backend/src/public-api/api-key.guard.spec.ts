import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApiKeyGuard } from './api-key.guard.js';

function context(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  const oldKey = 'pl_live_old-secret';
  const newKey = 'pl_live_new-secret';
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const config = {
    get: jest.fn().mockReturnValue(`${hash(oldKey)},${hash(newKey)}`),
  } as unknown as ConfigService;
  const guard = new ApiKeyGuard(config);

  it('accepts both keys during rotation', () => {
    expect(guard.canActivate(context(`Bearer ${oldKey}`))).toBe(true);
    expect(guard.canActivate(context(`Bearer ${newKey}`))).toBe(true);
  });

  it('rejects missing and invalid keys', () => {
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context('Bearer wrong'))).toThrow(UnauthorizedException);
  });
});
