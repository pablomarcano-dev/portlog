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
  Query,
  Req,
} from '@nestjs/common';
import { OwnersService } from './owners.service.js';
import { CreateOwnerDto, UpdateOwnerDto } from './dto/owner.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { OwnerListQuerySchema } from '@portlog/schemas';
import type { OwnerListQuery } from '@portlog/schemas';
import type { RequestUser } from '../../auth/jwt.strategy.js';

@Controller('master-data/owners')
@Roles('OPS', 'ADM')
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(OwnerListQuerySchema)) query: OwnerListQuery) {
    return this.ownersService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.ownersService.search(q ?? '');
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.ownersService.findById(id, req.user.permissions);
  }

  @Post()
  create(@Body() dto: CreateOwnerDto) {
    return this.ownersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOwnerDto, @Req() req: { user: RequestUser }) {
    return this.ownersService.update(id, dto, req.user.permissions, {
      userId: req.user.sub,
    });
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.ownersService.remove(id);
  }
}
