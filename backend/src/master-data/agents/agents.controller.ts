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
import { AgentsService } from './agents.service.js';
import { CreateAgentDto, UpdateAgentDto } from './dto/agent.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AgentListQuerySchema } from '@portlog/schemas';
import type { AgentListQuery } from '@portlog/schemas';

@Controller('master-data/agents')
@Roles('OPS', 'ADM')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(AgentListQuerySchema)) query: AgentListQuery) {
    return this.agentsService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.agentsService.search(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.agentsService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateAgentDto) {
    return this.agentsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.agentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.agentsService.remove(id);
  }
}
