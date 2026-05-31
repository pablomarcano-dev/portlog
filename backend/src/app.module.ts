import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { FlagsModule } from './master-data/flags/flags.module.js';
import { ActivitiesModule } from './master-data/activities/activities.module.js';
import { CargoesModule } from './master-data/cargoes/cargoes.module.js';
import { CharterersModule } from './master-data/charterers/charterers.module.js';
import { ShippersModule } from './master-data/shippers/shippers.module.js';
import { OperatorsModule } from './master-data/operators/operators.module.js';
import { AgentsModule } from './master-data/agents/agents.module.js';
import { SuppliersModule } from './master-data/suppliers/suppliers.module.js';
import { PortsModule } from './master-data/ports/ports.module.js';
import { ContactsModule } from './master-data/contacts/contacts.module.js';
import { OwnersModule } from './master-data/owners/owners.module.js';
import { ShipParticularsModule } from './master-data/ship-particulars/ship-particulars.module.js';
import { NominationsModule } from './nominations/nominations.module.js';
import { EmailGroupsModule } from './master-data/email-groups/email-groups.module.js';
import { PedrModule } from './pedr/pedr.module.js';
import { StorageModule } from './storage/storage.module.js';
import { PdfModule } from './pdf/pdf.module.js';
import { DatalasticModule } from './datalastic/datalastic.module.js';
import { FleetModule } from './fleet/fleet.module.js';
import { DispatchModule } from './dispatch/dispatch.module.js';
import { BranchesModule } from './master-data/branches/branches.module.js';
import { ClientsModule } from './master-data/clients/clients.module.js';
import { SHDocumentsModule } from './sh-documents/sh-documents.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Golden Rule 8: Structured logging with pino.
    // Redaction ensures passwords, tokens, and hashes never appear in logs.
    // This is load-bearing for a legally-sensitive platform.
    LoggerModule.forRoot({
      pinoHttp: {
        redact: [
          'req.body.password',
          'req.headers.authorization',
          '*.passwordHash',
          '*.tokenHash',
          '*.token',
          '*.refreshToken',
        ],
        transport: process.env['NODE_ENV'] !== 'production' ? { target: 'pino-pretty' } : undefined,
      },
    }),

    // Global rate-limiting defaults. Per-route overrides via @Throttle().
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60 * 1000, // 1 minute window (ms)
          limit: 60, // 60 requests/min global default
        },
      ],
    }),

    PrismaModule,
    HealthModule,
    AuthModule,
    FlagsModule,
    ActivitiesModule,
    CargoesModule,
    CharterersModule,
    ShippersModule,
    OperatorsModule,
    AgentsModule,
    SuppliersModule,
    PortsModule,
    ContactsModule,
    OwnersModule,
    ShipParticularsModule,
    NominationsModule,
    EmailGroupsModule,
    PedrModule,
    StorageModule,
    PdfModule,
    DatalasticModule,
    FleetModule,
    DispatchModule,
    SHDocumentsModule,
    BranchesModule,
    ClientsModule,
  ],
  providers: [
    // ThrottlerGuard must run first (before auth) so rate limits apply to all routes.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // JwtAuthGuard: global — verifies Bearer token on all routes not marked @Public().
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // RolesGuard: global — enforces @Roles() decorator. Runs after JwtAuthGuard.
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
