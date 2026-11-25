import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import {
  AdministrativeBillingCategorySchema,
  AdministrativeBillingUpdateSchema,
  type AdministrativeBillingCategory,
} from '@portlog/schemas';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AdministrativeNominationBillingService } from './administrative-nomination-billing.service.js';

class AdministrativeBillingUpdateDto extends createZodDto(AdministrativeBillingUpdateSchema) {}

@Controller('nominations/:id/administrative-billing')
@Roles('ADM', 'FLT')
export class AdministrativeNominationBillingController {
  constructor(private readonly billing: AdministrativeNominationBillingService) {}

  @Get()
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.getByNomination(id);
  }

  @Put(':category')
  async setRecipient(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('category', new ZodValidationPipe(AdministrativeBillingCategorySchema))
    category: AdministrativeBillingCategory,
    @Body() body: AdministrativeBillingUpdateDto,
  ) {
    const recipient = await this.billing.setRecipient(id, category, body);
    return { recipient };
  }
}
