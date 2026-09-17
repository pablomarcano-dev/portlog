import { Injectable } from '@nestjs/common';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TEMPLATE_PATH = path.join(__dirname, 'templates', 'operational-purchase-order.docx');

/** Fills the supplied SNCA-RG-AGN-005 form without changing its artwork or layout. */
@Injectable()
export class OperationalOrderDocxService {
  render(data: Record<string, string>): Buffer {
    const document = new Docxtemplater(new PizZip(fs.readFileSync(TEMPLATE_PATH)), {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });
    document.render(data);
    return document.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
