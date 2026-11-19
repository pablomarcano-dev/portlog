import { Injectable } from '@nestjs/common';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface AdministrativeNominationInstructionsTemplateData {
  snOt: string;
  vessel: string;
  arrivalDay: string;
  operationPort: string;
  portCostInstructions: string;
  ownerExpensesInstructions: string;
  technicalManagementInstructions: string;
  imo: string;
  grt: string;
  flag: string;
  dwt: string;
  loa: string;
  municipality: string;
  portCostsBilling: string;
  ownerExpensesBilling: string;
  technicalManagementBilling: string;
}

const TEMPLATE_PATH = path.join(
  __dirname,
  'templates',
  'administrative-nomination-instructions.docx',
);

@Injectable()
export class AdministrativeNominationInstructionsDocxService {
  render(data: AdministrativeNominationInstructionsTemplateData): Buffer {
    const template = fs.readFileSync(TEMPLATE_PATH);
    const document = new Docxtemplater(new PizZip(template), {
      linebreaks: true,
      nullGetter: () => '',
      stripInvalidXMLChars: true,
    });

    document.render(data);

    return document.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
