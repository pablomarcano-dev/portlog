import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^Bearer\s+(.+)$/i);

    if (!match?.[1] || !this.matchesConfiguredHash(match[1])) {
      throw new UnauthorizedException('Invalid API key.');
    }
    return true;
  }

  private matchesConfiguredHash(key: string): boolean {
    const suppliedHash = createHash('sha256').update(key, 'utf8').digest();
    const configuredHashes = (this.config.get<string>('PUBLIC_API_KEY_HASHES') ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => /^[a-f0-9]{64}$/.test(value));

    // Check every configured key instead of returning on the first match. This
    // keeps rotation (old + new key active together) from changing timing based
    // on which key a caller used.
    let matched = false;
    for (const configuredHash of configuredHashes) {
      matched = timingSafeEqual(suppliedHash, Buffer.from(configuredHash, 'hex')) || matched;
    }
    return matched;
  }
}
