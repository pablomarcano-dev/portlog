import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PiersService } from './piers.service.js';
import { createZodDto } from 'nestjs-zod';
import { PierCreateSchema, PierUpdateSchema } from '@portlog/schemas';
import { Roles } from '../../auth/roles.decorator.js';

class CreatePierDto extends createZodDto(PierCreateSchema) {}
class UpdatePierDto extends createZodDto(PierUpdateSchema) {}

@Controller('master-data/ports/:portId/piers')
@Roles('OPS', 'ADM')
export class PiersController {
  constructor(private readonly piersService: PiersService) {}

  @Get()
  async list(@Param('portId') portId: string) {
    const items = await this.piersService.listByPort(portId);
    return { items };
  }

  @Post()
  create(@Param('portId') portId: string, @Body() dto: CreatePierDto) {
    return this.piersService.create({ name: dto.name, portId });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePierDto) {
    return this.piersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.piersService.remove(id);
  }
}
