import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { UsersService } from './users.service.js';
import type { CreateUserDto, UpdateUserDto } from './users.service.js';

type AuthRequest = { user: { sub: string } };

@Controller('admin/users')
@Roles('ADM')
export class UsersAdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list() {
    const items = await this.usersService.list();
    return { items };
  }

  @Post()
  async create(@Body() body: CreateUserDto) {
    return this.usersService.create(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Request() req: AuthRequest) {
    await this.usersService.delete(id, req.user.sub);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Param('id') id: string, @Body() body: { newPassword: string }) {
    await this.usersService.resetPassword(id, body.newPassword);
  }

  @Post(':id/send-credentials')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sendCredentials(@Param('id') id: string) {
    await this.usersService.sendCredentials(id);
  }
}
