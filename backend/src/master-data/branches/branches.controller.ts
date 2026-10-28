import { z } from 'zod';
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
} from '@nestjs/common';
import { BranchesService } from './branches.service.js';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { BranchListQuerySchema } from '@portlog/schemas';
import type { BranchListQuery } from '@portlog/schemas';

@Controller('master-data/branches')
@Roles('OPS', 'ADM')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(BranchListQuerySchema)) query: BranchListQuery) {
    return this.branchesService.list(query);
  }

  @Get(':id/ports')
  ports(@Param('id') id: string) {
    return this.branchesService.ports(id);
  }

  @Post(':id/ports/:portId')
  assignPort(
    @Param('id') id: string,
    @Param('portId') portId: string,
    @Body(
      new ZodValidationPipe(z.object({ previousBranchId: z.string().cuid().nullable() }).strict()),
    )
    body: { previousBranchId: string | null },
  ) {
    return this.branchesService.assignPort(id, portId, body.previousBranchId);
  }

  @Delete(':id/ports/:portId')
  unassignPort(@Param('id') id: string, @Param('portId') portId: string) {
    return this.branchesService.unassignPort(id, portId);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.branchesService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.branchesService.remove(id);
  }
}
