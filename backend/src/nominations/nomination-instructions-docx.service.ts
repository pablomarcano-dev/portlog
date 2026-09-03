import { Injectable } from '@nestjs/common';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type NominationInstructionsTemplateData = Record<string, string>;

const TEMPLATE_PATH = path.join(__dirname, 'templates', 'nomination-instructions.docx');

/**
 * Fills the retained SNCA-RG-AGN-001 Word document in place.
 *
 * The template is the supplied DOCX with scalar tags inserted into its existing
 * table cells. Docxtemplater changes those text nodes while preserving the
 * document's sections, merged table geometry, headers, footer, and artwork.
 */
@Injectable()
export class NominationInstructionsDocxService {
  render(data: NominationInstructionsTemplateData): Buffer {
    const template = fs.readFileSync(TEMPLATE_PATH);
    const document = new Docxtemplater(new PizZip(template), {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '—',
    });

    document.render(data);

    return document.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
  }
}
