import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import Handlebars from 'handlebars';
import { readdir, readFile } from 'fs/promises';
import { basename, extname, resolve } from 'path';
import { wrapPlainTextEmailBody } from '../email/email-body.util.js';

/** Directory under `templates/` holding shared partials rather than whole emails. */
export const PARTIALS_DIRNAME = '_partials';

/**
 * Templates live outside `dist/` and are read at render time (see the Dockerfile,
 * which copies `backend/templates` verbatim). Reading per render — instead of
 * caching at boot — keeps the dev loop of "edit a template, resend" working
 * without a restart.
 */
function templatesRoot(): string {
  return resolve(process.cwd(), 'templates');
}

export interface RenderedTemplate {
  /**
   * Subject taken from the template's `{{!-- Subject: … --}}` header, already
   * compiled. `null` when the template declares none — the caller owns the
   * fallback, since a sensible default is domain-specific.
   */
  subject: string | null;
  bodyText: string;
  /** `bodyText` wrapped for HTML display, preserving the plain-text layout. */
  bodyHtml: string;
}

/**
 * Single entry point for rendering the plain-text email templates under
 * `templates/`.
 *
 * It exists so that the signature is composed in exactly one place: every
 * template ends with `{{> signature}}`, and this service is what registers that
 * partial. Handlebars throws "The partial signature could not be found" when a
 * partial is missing, so compiling a template anywhere else is a hard failure,
 * not a silent one — always render through here.
 *
 * The corollary for deploys: `templates/` and this code must ship together. The
 * Dockerfile copies both from the same build, so they cannot diverge in prod;
 * in dev a stale watch process will 500 until it picks the new build up.
 */
@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);

  /**
   * Isolated Handlebars environment. The PDF service compiles its own HTML
   * templates against the global `Handlebars`, and these plain-text partials
   * must not leak into that namespace (or vice versa).
   */
  private readonly hbs = Handlebars.create();

  /**
   * `{{!-- … --}}` comments are stripped during compilation, so the subject has
   * to be lifted out of the source beforehand.
   */
  private static readonly SUBJECT_RE = /\{\{!--\s*Subject:\s*(.+?)\s*--\}\}/;

  async render(relPath: string, vars: Record<string, unknown>): Promise<RenderedTemplate> {
    // An unmapped action type resolves to a path that does not exist. Left as a
    // raw ENOENT it surfaces as a 500 and the compose drawer just opens blank —
    // which is how NOR shipped with no subject and no recipients. Name the file.
    let source: string;
    try {
      source = await readFile(resolve(templatesRoot(), relPath), 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException(`Email template "${relPath}" not found.`);
      }
      throw err;
    }
    await this.registerPartials();

    const subjectMatch = EmailTemplateService.SUBJECT_RE.exec(source);
    const subject =
      subjectMatch?.[1] !== undefined ? this.hbs.compile(subjectMatch[1])(vars) : null;

    const bodyText = this.hbs.compile(source)(vars);

    return { subject, bodyText, bodyHtml: EmailTemplateService.wrapPlainText(bodyText) };
  }

  /** Lists every renderable template, i.e. excluding the partials directory. */
  static async listTemplates(): Promise<string[]> {
    const entries = await readdir(templatesRoot(), {
      recursive: true,
      withFileTypes: true,
    });
    return entries
      .filter((e) => e.isFile() && extname(e.name) === '.hbs')
      .map((e) => resolve(e.parentPath, e.name))
      .filter((p) => !p.includes(`/${PARTIALS_DIRNAME}/`))
      .map((p) => p.slice(templatesRoot().length + 1))
      .sort();
  }

  /**
   * Wraps plain-text output so a mail client renders the fixed-width layout the
   * templates are written in. Sources that already emit HTML pass through.
   */
  private static wrapPlainText(bodyText: string): string {
    return wrapPlainTextEmailBody(bodyText);
  }

  /**
   * Registers every `_partials/*.hbs` under its bare filename, so a template
   * refers to `_partials/signature.hbs` as `{{> signature}}`.
   */
  private async registerPartials(): Promise<void> {
    const dir = resolve(templatesRoot(), PARTIALS_DIRNAME);

    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      // No partials directory is legitimate — templates simply have nothing to include.
      this.logger.warn(`No ${PARTIALS_DIRNAME} directory at ${dir}; partials unavailable.`);
      return;
    }

    await Promise.all(
      names
        .filter((name) => extname(name) === '.hbs')
        .map(async (name) => {
          const source = await readFile(resolve(dir, name), 'utf8');
          this.hbs.registerPartial(basename(name, '.hbs'), source);
        }),
    );
  }
}
