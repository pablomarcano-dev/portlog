import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // Cast via unknown: NestFastifyApplication.enableCors uses FastifyCorsOptions which
  // diverges from INestApplication.enableCors (CorsOptions) — upstream type incompatibility.
  const app = (await NestFactory.create(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  })) as unknown as NestFastifyApplication;

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port, '0.0.0.0');
}

bootstrap();
