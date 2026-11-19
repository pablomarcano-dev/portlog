import PizZip from 'pizzip';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AdministrativeNominationInstructionsDocxService,
  type AdministrativeNominationInstructionsTemplateData,
} from './administrative-nomination-instructions-docx.service.js';

const sample: AdministrativeNominationInstructionsTemplateData = {
  snOt: 'OT-26/0042',
  vessel: 'MV Example',
  arrivalDay: 'NOV 20, 2026',
  operationPort: 'Example Terminal',
  portCostInstructions: 'Verify the disbursement account.\nRetain the original receipts.',
  ownerExpensesInstructions: 'Confirm advance approval.',
  technicalManagementInstructions: 'Reconcile the statement of facts.',
  imo: '1234567',
  grt: '12345',
  flag: 'PANAMA',
  dwt: '76543',
  loa: '125.50',
  municipality: 'Example Municipality',
  portCostsBilling: 'Example Port Billing\n100 Example Avenue',
  ownerExpensesBilling: 'Example Owners Billing\n200 Example Avenue',
  technicalManagementBilling: 'Example Technical Billing\n300 Example Avenue',
};

const service = new AdministrativeNominationInstructionsDocxService();

describe('AdministrativeNominationInstructionsDocxService', () => {
  it('fills each form section and preserves the quality-system header and logo', () => {
    const document = new PizZip(service.render(sample));
    const body = document.file('word/document.xml')?.asText() ?? '';
    const header = document.file('word/header2.xml')?.asText() ?? '';

    for (const line of Object.values(sample).flatMap((value) => value.split('\n'))) {
      expect(body).toContain(line);
    }
    expect(body).toContain('<w:br');
    expect(body).not.toMatch(/\{[A-Za-z]+\}|PDVSA|SN3092/);
    expect(header.replace(/<[^>]+>/g, '')).toContain('SNCA-RG-AGN-002');
    expect(header.replace(/<[^>]+>/g, '')).toContain('NOMINATION INSTRUCTIONS ADMINISTRATIVO');

    const template = new PizZip(
      fs.readFileSync(
        path.join(__dirname, 'templates', 'administrative-nomination-instructions.docx'),
      ),
    );
    const logo = 'word/media/image2.png';
    expect(document.file(logo)?.asBinary()).toBe(template.file(logo)?.asBinary());
    expect(document.file(logo)?.asBinary()).toBeDefined();
  });

  it('keeps empty sections blank and inserts pasted text as escaped Word text', () => {
    const document = new PizZip(
      service.render({
        ...sample,
        technicalManagementBilling: '',
        portCostInstructions: 'Value & <condition>\u000b',
      }),
    );
    const body = document.file('word/document.xml')?.asText() ?? '';
    expect(body).toContain('Value &amp; &lt;condition&gt;');
    expect(body).not.toMatch(/\{technicalManagementBilling\}|undefined|null/);
    expect(body).not.toContain('\u000b');
  });
});
