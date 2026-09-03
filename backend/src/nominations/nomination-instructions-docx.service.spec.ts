import PizZip from 'pizzip';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NominationInstructionsDocxService } from './nomination-instructions-docx.service.js';

const SAMPLE = {
  snOt: 'SN-26/0042 / 42/PLC',
  vessel: 'MV Exact Template',
  owner: 'Template Owner Ltd.',
  operator: 'Template Operator Ltd.',
  charterer: 'Template Charterer Ltd.',
  lastPort: 'Previous Port',
  nextPort: 'Next Port',
  operationPort: 'Operating Port — Main Berth',
  operations: 'LOAD 2,000 MT PRODUCT A\nDISCHARGE 500 MT PRODUCT B',
  laycan: 'SEP 12, 2026 — SEP 15, 2026',
  firstMessage: 'first@example.com\ncontact@example.com',
  secondMessage: 'second@example.com',
  thirdMessage: 'third@example.com',
  ccMessage: 'copy@example.com',
  nominationInstructions: 'Use the client nomination procedure.\nConfirm every ETA update.',
  nominationNotes: 'ETA: SEP 11, 2026\nReference: QA-42',
  portCosts: 'Template Client\nBilling address\nReference: QA-42',
  commercialOperator: 'Template Charterer Ltd.\nReference: CO-42',
  technicalManager: 'Template Operator Ltd.\nReference: TM-42',
};

describe('NominationInstructionsDocxService', () => {
  it('fills the supplied Word template and preserves its embedded document furniture', () => {
    const service = new NominationInstructionsDocxService();
    const output = service.render(SAMPLE);
    const generated = new PizZip(output);
    const template = new PizZip(
      fs.readFileSync(path.join(__dirname, 'templates', 'nomination-instructions.docx')),
    );

    const documentXml = generated.file('word/document.xml')?.asText() ?? '';
    for (const value of Object.values(SAMPLE)) {
      expect(documentXml).toContain(value.split('\n')[0]);
    }
    expect(documentXml).not.toMatch(/\{[A-Za-z]+\}/);

    for (const preservedPart of [
      'word/header1.xml',
      'word/header2.xml',
      'word/footer1.xml',
      'word/media/image1.jpeg',
      'word/media/image2.png',
    ]) {
      expect(generated.file(preservedPart)?.asBinary()).toBe(
        template.file(preservedPart)?.asBinary(),
      );
    }
  });
});
