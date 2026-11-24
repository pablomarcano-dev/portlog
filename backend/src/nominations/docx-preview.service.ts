import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_DOCX_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_CONCURRENT_PREVIEWS = 2;
const CONVERSION_TIMEOUT_MS = 45_000;

/** Converts only server-generated NI documents, without uploading their contents. */
@Injectable()
export class DocxPreviewService implements OnModuleDestroy {
  private readonly logger = new Logger(DocxPreviewService.name);
  private active = 0;
  private stopping = false;
  private readonly cancelConversions = new Set<() => void>();

  constructor(private readonly config: ConfigService) {}

  onModuleDestroy(): void {
    this.stopping = true;
    for (const cancel of this.cancelConversions) cancel();
  }

  async convert(document: Buffer): Promise<Buffer> {
    if (this.stopping || document.length === 0 || document.length > MAX_DOCX_BYTES) {
      throw new ServiceUnavailableException('The instruction document cannot be previewed.');
    }
    // Reject excess work instead of accumulating an unbounded conversion queue.
    if (this.active >= MAX_CONCURRENT_PREVIEWS) {
      throw new ServiceUnavailableException('Document previews are busy. Please try again.');
    }
    this.active += 1;
    let directory: string | undefined;
    try {
      directory = await mkdtemp(join(tmpdir(), 'portlog-ni-preview-'));
      const profile = join(directory, 'profile');
      await mkdir(profile, { mode: 0o700 });
      await mkdir(join(profile, 'xdg_config'), { mode: 0o700 });
      await mkdir(join(profile, 'xdg_cache'), { mode: 0o700 });
      const input = join(directory, 'instructions.docx');
      const output = join(directory, 'instructions.pdf');
      await writeFile(input, document, { mode: 0o600 });
      await this.execute(
        this.config.get<string>('SOFFICE_EXECUTABLE_PATH') ?? '/usr/bin/soffice',
        [
          `-env:UserInstallation=${pathToFileURL(profile).href}`,
          '--invisible',
          '--headless',
          '--norestore',
          '--convert-to',
          'pdf',
          '--outdir',
          directory,
          input,
        ],
        directory,
      );
      const info = await stat(output);
      if (!info.isFile() || info.size === 0 || info.size > MAX_PDF_BYTES) {
        throw new Error('Invalid preview output size');
      }
      const pdf = await readFile(output);
      if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
        throw new Error('Invalid preview output type');
      }
      return pdf;
    } catch {
      // Converter output and arguments can contain customer data or local paths.
      // Return a stable user-facing error; do not put them into logs or responses.
      this.logger.warn('Local instruction preview conversion failed');
      throw new ServiceUnavailableException(
        'The document preview is temporarily unavailable. You can still download the Word document.',
      );
    } finally {
      try {
        if (directory) await rm(directory, { recursive: true, force: true });
      } catch {
        this.logger.warn('Could not clean up local instruction preview files');
      } finally {
        this.active -= 1;
      }
    }
  }

  private execute(executable: string, args: string[], directory: string): Promise<void> {
    if (this.stopping) return Promise.reject(new Error('Document conversion cancelled'));
    const configuredTimeout = Number(this.config.get<string>('DOCX_PREVIEW_TIMEOUT_MS'));
    const timeout =
      Number.isInteger(configuredTimeout) &&
      configuredTimeout >= 1000 &&
      configuredTimeout <= CONVERSION_TIMEOUT_MS
        ? configuredTimeout
        : CONVERSION_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
      // Unix process groups include the soffice launcher, soffice.bin and any
      // descendants. Killing only the launcher can leave conversions running.
      const child = spawn(executable, args, {
        detached: process.platform !== 'win32',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: directory,
        env: {
          ...process.env,
          HOME: join(directory, 'profile'),
          TMPDIR: directory,
          XDG_CONFIG_HOME: join(directory, 'profile', 'xdg_config'),
          XDG_CACHE_HOME: join(directory, 'profile', 'xdg_cache'),
        },
      });
      let failure: Error | undefined;
      let outputBytes = 0;
      let settled = false;
      const terminate = () => {
        if (!child.pid) return;
        try {
          if (process.platform === 'win32') child.kill('SIGKILL');
          else process.kill(-child.pid, 'SIGKILL');
        } catch {
          // ESRCH is expected after a normal conversion has already exited.
        }
      };
      const cancel = () => {
        failure = new Error('Document conversion cancelled');
        terminate();
      };
      this.cancelConversions.add(cancel);
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        this.cancelConversions.delete(cancel);
        clearTimeout(timer);
        terminate();
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(() => {
        failure = new Error('Document conversion timed out');
        terminate();
        // Wait for close before removing files and releasing the active slot.
      }, timeout);
      const drain = (chunk: Buffer) => {
        outputBytes += chunk.length;
        if (outputBytes > 1024 * 1024 && !failure) {
          failure = new Error('Excess converter output');
          terminate();
        }
      };
      child.stdout.on('data', drain);
      child.stderr.on('data', drain);
      child.once('error', (error) => finish(error));
      child.once('close', (code) =>
        finish(failure ?? (code === 0 ? undefined : new Error('Document conversion failed'))),
      );
    });
  }
}
