import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import { MAX_ATTACHMENT_SIZE_BYTES, MAX_ATTACHMENTS_PER_EMAIL } from '@portlog/schemas';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // Cast via unknown: NestFastifyApplication.enableCors uses FastifyCorsOptions which
  // diverges from INestApplication.enableCors (CorsOptions) — upstream type incompatibility.
  const app = (await NestFactory.create(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  })) as unknown as NestFastifyApplication;

  app.useLogger(app.get(Logger));

  // Register @fastify/cookie so that reply.setCookie() and request.cookies work.
  // Must be registered before listen().
  // Type cast via unknown: @fastify/cookie uses export = (CJS) which creates a
  // minor type mismatch with NestFastifyApplication.register's union parameter type.
  // The double-cast (as unknown as Parameters<typeof app.register>[0]) is safe here
  // because fastifyCookie is a valid Fastify plugin at runtime.

  await app.register(fastifyCookie as unknown as Parameters<typeof app.register>[0]);

  // Security headers. The API serves JSON and streams attachments — it renders
  // no HTML — so the useful headers here are the sniffing and framing ones
  // rather than a script CSP.
  //
  // contentSecurityPolicy is off deliberately: helmet's default policy is written
  // for HTML documents and applying it to JSON responses buys nothing while
  // risking breakage on the attachment download path. The frontend is served by
  // nginx, which is where a document CSP belongs.
  //
  // HSTS is set by nginx on the TLS vhost, not here: a browser ignores the header
  // over plain HTTP, and nginx is the only place that knows whether the request
  // actually arrived over TLS.
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    hsts: false,
    // Attachments are streamed cross-origin to the frontend; the default
    // require-corp policy would block them.
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // Register @fastify/multipart for email attachment uploads (POST /api/attachments).
  // One file per request; the frontend uploads each selected file separately.
  // fileSize is the hard per-file cap — @fastify/multipart aborts the stream past it.
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: MAX_ATTACHMENT_SIZE_BYTES,
      files: 1,
      // Small non-file field allowance (none expected, but keep the parser happy).
      fields: MAX_ATTACHMENTS_PER_EMAIL,
    },
  });

  // CORS: allow the frontend origin with credentials (required for httpOnly cookie exchange).
  // SameSite=Lax on the cookie is sufficient for CSRF protection; credentials: true
  // allows the browser to include cookies on cross-origin requests to the API.
  // The localhost regex is a development convenience only. In production an
  // unset CORS_ORIGIN used to fall back to it silently — the app kept serving
  // with an origin allowlist that matched nothing it actually talks to. That
  // case is now rejected at startup by validateEnv, so reaching the fallback
  // here means we are genuinely in development.
  const corsOrigin = process.env['CORS_ORIGIN'] ?? /^http:\/\/localhost(:\d+)?$/;
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix('api');

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port, '0.0.0.0');
}

bootstrap();
