import PizZip from 'pizzip';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { OperationalOrderDocxService } from './operational-order-docx.service.js';

describe('OperationalOrderDocxService', () => {
  it('fills the retained Word form and keeps its logo, headers, footer and signature fields', () => {
    const template = new PizZip(
      fs.readFileSync(path.join(__dirname, 'templates', 'operational-purchase-order.docx')),
    );
    const data = {
      snOt: 'SN-26/0042',
      orderNumber: 'SN1234/26/PLC',
      vessel: 'MT Portlog',
      supplier: 'Proveedor Uno',
      branch: 'Puerto La Cruz',
      executionDate: '10/08/2026',
      operation: 'Servicio de Remolcadores',
      terminal: 'Muelle 3',
      departure: '',
      destination: '',
      startTime: '14:00 UTC',
      contact: '',
      item1Description: 'Servicio de Remolcadores',
      item1Quantity: '2',
      item2Description: 'Tipo de Operación: Atraque',
      item2Quantity: '',
      item3Description: 'Cantidad de Remolcadores: 2',
      item3Quantity: '',
      item4Description: '',
      item4Quantity: '',
      item5Description: '',
      item5Quantity: '',
      observations: 'Confirmar por radio.',
      agent: 'Agente Naviero',
      preparationDate: '01/03/2026',
      approver: 'Jefe de Sucursal',
      approvalDate: '02/03/2026',
    };
    const generated = new PizZip(new OperationalOrderDocxService().render(data));
    const xml = generated.file('word/document.xml')?.asText() ?? '';

    for (const value of Object.values(data).filter(Boolean)) expect(xml).toContain(value);
    expect(xml).not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}/);
    expect(xml).toContain('FIRMA Y SELLO DEL PROVEEDOR');
    for (const part of [
      'word/header1.xml',
      'word/header2.xml',
      'word/footer1.xml',
      'word/media/image1.jpeg',
      'word/media/image2.png',
    ]) {
      expect(generated.file(part)?.asBinary()).toBe(template.file(part)?.asBinary());
    }
  });
});
