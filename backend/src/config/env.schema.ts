import { Logger } from '@nestjs/common';
import { z } from 'zod';

/**
 * Startup validation for the process environment.
 *
 * The point is to fail loudly at boot rather than run with a security control
 * silently disabled. Before this existed, an unset variable produced a working
 * app with the wrong behaviour: MINIO_ACCESS_KEY falling back to `minioadmin`,
 * CORS_ORIGIN falling back to a localhost regex, TZ falling back to UTC. None of
 * those announce themselves — the app starts, serves traffic, and is quietly
 * less protected (or less correct) than the config file suggests.
 *
 * Two deliberate constraints on this schema:
 *
 * 1. **It validates shape, it does not transform types.** Every consumer in the
 *    codebase reads these as strings — `=== 'true'`, `parseInt(...)` — and two
 *    of them (COOKIE_SECURE, PORT) read `process.env` directly rather than going
 *    through ConfigService. Coercing here would make ConfigService disagree with
 *    `process.env` about the type of the same variable, which is a worse bug
 *    than the one being fixed. Retyping the config surface is a refactor, not a
 *    security fix.
 *
 * 2. **`.passthrough()` is load-bearing.** Nest uses whatever this function
 *    returns as the config object, and Zod strips unknown keys by default.
 *    Without it, every variable not named here — DATALASTIC_API_KEY,
 *    CHROMIUM_EXECUTABLE_PATH, DIRECT_URL, COOKIE_DOMAIN — would silently vanish
 *    from ConfigService and take its integration with it.
 */

const boolString = z.enum(['true', 'false']);
const numericString = z.string().regex(/^\d+$/, 'must be a positive integer');

const baseSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
    PORT: numericString.optional(),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // 32 bytes of base64 is 44 characters; much shorter than that is a
    // placeholder rather than a key. Generate with: openssl rand -base64 32
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'must be at least 32 characters — generate with `openssl rand -base64 32`'),
    JWT_ACCESS_TTL: z.string().optional(),
    JWT_REFRESH_TTL_DAYS: numericString.optional(),

    // Optional here, required in production below. Locally an unset TZ means
    // Node uses the machine's zone, which is right for a developer in the
    // operating region; in a container it means UTC.
    TZ: z.string().min(1).optional(),

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
    COOKIE_SECURE: boolString.optional(),

    // Storage. No defaults anywhere: the previous fallback to
    // minioadmin/minioadmin meant a missing variable produced a running app
    // holding every issued document behind well-known credentials.
    MINIO_ENDPOINT: z.string().min(1),
    MINIO_PORT: numericString.optional(),
    MINIO_USE_SSL: boolString.optional(),
    MINIO_BUCKET: z.string().min(1),
    MINIO_ACCESS_KEY: z.string().min(1, 'must be set — no default is safe'),
    MINIO_SECRET_KEY: z.string().min(1, 'must be set — no default is safe'),

    // Mail
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: numericString,
    SMTP_SECURE: boolString.optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().min(1),

    // Optional integrations — absent means the feature is off, which is safe.
    AIS_PROVIDER: z.string().optional(),
    AIS_API_KEY: z.string().optional(),
    WHATSAPP_MODE: z.string().optional(),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_WHATSAPP_NUMBER: z.string().optional(),

    APP_URL: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
  })
  .passthrough();

export type Env = z.infer<typeof baseSchema>;

/**
 * Passed to `ConfigModule.forRoot({ validate })`. Nest calls this once at
 * startup and refuses to boot if it throws.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = baseSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  // Production-only expectations. These WARN rather than throw, and the reason
  // is worth recording: on a developer machine NODE_ENV currently resolves to
  // 'production' from the monorepo-root .env rather than 'development' from
  // backend/.env — the working-directory ambiguity the comment on
  // ConfigModule.forRoot describes. Until that is fixed, throwing here would
  // stop `npm run dev` booting on a correctly configured machine, which is a
  // worse outcome than a loud warning.
  //
  // Everything above this line still fails hard. Only these two, whose trigger
  // depends on NODE_ENV being trustworthy, are advisory.
  if (raw['NODE_ENV'] === 'production') {
    const warnings: string[] = [];
    if (!result.data.CORS_ORIGIN) {
      warnings.push(
        'CORS_ORIGIN is unset — the API falls back to a localhost origin allowlist, ' +
          'which does not match a deployed frontend',
      );
    }
    if (!result.data.TZ) {
      warnings.push(
        'TZ is unset — the process runs UTC, shifting every generated notice by four hours ' +
          'and sometimes onto the wrong day (see docs/DEPLOYMENT.md)',
      );
    }
    // Nest's static logger rather than console: this runs before the pino
    // logger is wired up, but console is banned repo-wide precisely because it
    // bypasses redaction, and a warning is not worth an exception to that.
    for (const w of warnings) {
      Logger.warn(w, 'EnvValidation');
    }
  }

  return result.data;
}
