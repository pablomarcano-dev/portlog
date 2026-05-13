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
import { ContactsService } from './contacts.service.js';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ContactListQuerySchema } from '@portlog/schemas';
import type { ContactListQuery } from '@portlog/schemas';

@Controller('master-data/contacts')
@Roles('OPS', 'ADM')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(ContactListQuerySchema)) query: ContactListQuery) {
    return this.contactsService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.contactsService.search(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.contactsService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateContactDto) {
    return this.contactsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }
}
