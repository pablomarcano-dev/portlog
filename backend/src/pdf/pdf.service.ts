import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Browser, Page } from 'puppeteer-core';
import { type PedrSubDocumentType } from '@portlog/schemas';

const TEMPLATES_DIR = path.join(__dirname, 'templates');

const TEMPLATE_MAP: Record<PedrSubDocumentType, string> = {
  ACKNOWLEDGEMENT: 'acknowledgement.hbs',
  PREARRIVAL: 'prearrival.hbs',
  ETA_ETB: 'eta-etb.hbs',
  NOR: 'nor.hbs',
  SOF: 'sof.hbs',
  CARGO_UPDATE: 'cargo-update.hbs',
};

@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: Browser | null = null;
  private readonly executablePath: string | undefined;
  private chromiumAvailable = true;

  constructor(private readonly config: ConfigService) {
    this.executablePath = this.config.get<string>('CHROMIUM_EXECUTABLE_PATH');
  }

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close();
  }

  async renderSubDocument(
    type: PedrSubDocumentType,
    data: Record<string, unknown>,
  ): Promise<Buffer> {
    const templateFile = TEMPLATE_MAP[type];
    const templatePath = path.join(TEMPLATES_DIR, templateFile);
    const source = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(source);
    const html = template({ ...data, generatedAt: new Date().toISOString() });
    return this.renderHtml(html);
  }

  async renderTemplate(templateName: string, context: Record<string, unknown>): Promise<Buffer> {
    const templatePath = path.join(TEMPLATES_DIR, templateName);
    const source = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(source);
    const html = template({ ...context, generatedAt: new Date().toISOString() });
    return this.renderHtml(html);
  }

  async renderFromString(source: string, context: Record<string, unknown>): Promise<Buffer> {
    const template = Handlebars.compile(source);
    const html = template({ ...context, generatedAt: new Date().toISOString() });
    return this.renderHtml(html);
  }

  async renderHtml(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    let page: Page | null = null;
    try {
      page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const buffer = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(buffer);
    } finally {
      await page?.close();
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;

    // Dynamic import so the module loads even if puppeteer-core is not fully configured
    const puppeteer = await import('puppeteer-core');
    this.browser = await puppeteer.launch({
      executablePath: this.executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    this.browser.on('disconnected', () => {
      this.logger.warn('Puppeteer browser disconnected — will re-initialize on next request');
      this.browser = null;
    });

    return this.browser;
  }
}
