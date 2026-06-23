import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersAdminController } from './users-admin.controller.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [EmailModule],
  controllers: [UsersAdminController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
