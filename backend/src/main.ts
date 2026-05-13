import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import fastifyCookie from '@fastify/cookie';
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

  // CORS: allow the frontend origin with credentials (required for httpOnly cookie exchange).
  // SameSite=Lax on the cookie is sufficient for CSRF protection; credentials: true
  // allows the browser to include cookies on cross-origin requests to the API.
  const corsOrigin = process.env['CORS_ORIGIN'] ?? 'http://localhost:5173';
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
