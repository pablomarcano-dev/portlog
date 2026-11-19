import type { ThrottlerModuleOptions } from '@nestjs/throttler';

export function throttlingOptions(environment: string | undefined): ThrottlerModuleOptions {
  return {
    // Cypress shares one loopback IP across its isolated test suite. Every
    // other environment retains the global and stricter auth route limits.
    skipIf: () => environment === 'test',
    throttlers: [{ name: 'default', ttl: 60 * 1000, limit: 60 }],
  };
}
