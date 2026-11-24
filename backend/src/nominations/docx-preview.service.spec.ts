import { execFileSync } from 'node:child_process';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { mkdtemp, readFile, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocxPreviewService } from './docx-preview.service';

describe('local instruction preview conversion', () => {
  let fixtures: string;
  let executable: string;
  let service: DocxPreviewService;
  const oldMode = process.env.PREVIEW_FIXTURE_MODE;
  const oldLog = process.env.PREVIEW_FIXTURE_LOG;

  beforeEach(async () => {
    fixtures = await mkdtemp(join(tmpdir(), 'ni-converter-test-'));
    executable = join(fixtures, 'converter');
    process.env.PREVIEW_FIXTURE_LOG = join(fixtures, 'directories.jsonl');
    delete process.env.PREVIEW_FIXTURE_MODE;
    // A real child process exercises argument handling, filesystem isolation and
    // cleanup without requiring LibreOffice in every unit-test environment.
    await writeFile(
      executable,
      `#!${process.execPath}\nconst fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const output = args[args.indexOf('--outdir') + 1];
fs.appendFileSync(process.env.PREVIEW_FIXTURE_LOG, JSON.stringify(output) + '\\n');
if (!args.includes('--headless') || !args.some(a => a.startsWith('-env:UserInstallation=file:'))) process.exit(4);
if (process.env.PREVIEW_FIXTURE_MODE === 'fail') process.exit(3);
if (process.env.PREVIEW_FIXTURE_MODE === 'missing') process.exit(0);
if (process.env.PREVIEW_FIXTURE_MODE === 'hang') {
 const child = require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' });
 fs.writeFileSync(process.env.PREVIEW_FIXTURE_LOG + '.child', String(child.pid));
 setInterval(() => {}, 1000);
}
const input = fs.readFileSync(args[args.length - 1]);
const finish = () => fs.writeFileSync(path.join(output, 'instructions.pdf'), process.env.PREVIEW_FIXTURE_MODE === 'invalid' ? '<html>no</html>' : Buffer.concat([Buffer.from('%PDF-1.7\\n'), input]));
if (process.env.PREVIEW_FIXTURE_MODE === 'slow') setTimeout(finish, 200); else finish();
`,
      { mode: 0o700 },
    );
    service = new DocxPreviewService(new ConfigService({ SOFFICE_EXECUTABLE_PATH: executable }));
  });

  afterEach(async () => {
    if (oldMode === undefined) delete process.env.PREVIEW_FIXTURE_MODE;
    else process.env.PREVIEW_FIXTURE_MODE = oldMode;
    if (oldLog === undefined) delete process.env.PREVIEW_FIXTURE_LOG;
    else process.env.PREVIEW_FIXTURE_LOG = oldLog;
    await rm(fixtures, { recursive: true, force: true });
  });

  async function directories(): Promise<string[]> {
    return (await readFile(join(fixtures, 'directories.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as string);
  }

  it('converts the exact input bytes and removes every temporary conversion directory', async () => {
    const input = Buffer.from('the populated Word document');
    const pdf = await service.convert(input);
    expect(pdf).toEqual(Buffer.concat([Buffer.from('%PDF-1.7\n'), input]));
    for (const directory of await directories()) {
      await expect(access(directory)).rejects.toThrow();
    }
  });

  it.each(['fail', 'missing', 'invalid'])(
    'returns a stable failure for %s output and cleans up',
    async (mode) => {
      process.env.PREVIEW_FIXTURE_MODE = mode;
      await expect(service.convert(Buffer.from('document'))).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      for (const directory of await directories()) {
        await expect(access(directory)).rejects.toThrow();
      }
      // A failure releases the concurrency slot for subsequent attempts.
      delete process.env.PREVIEW_FIXTURE_MODE;
      await expect(service.convert(Buffer.from('retry'))).resolves.toBeInstanceOf(Buffer);
    },
  );

  it('rejects excess conversions while isolating the two accepted jobs', async () => {
    process.env.PREVIEW_FIXTURE_MODE = 'slow';
    const first = service.convert(Buffer.from('one'));
    const second = service.convert(Buffer.from('two'));
    await expect(service.convert(Buffer.from('third'))).rejects.toThrow('busy');
    const result = await Promise.all([first, second]);
    expect(result[0].toString()).toContain('one');
    expect(result[1].toString()).toContain('two');
    expect(new Set(await directories()).size).toBe(2);
    for (const directory of await directories()) {
      await expect(access(directory)).rejects.toThrow();
    }
  });

  it('kills a hung launcher and its child before releasing the slot or cleaning files', async () => {
    if (process.platform === 'win32') return;
    process.env.PREVIEW_FIXTURE_MODE = 'hang';
    service = new DocxPreviewService(
      new ConfigService({
        SOFFICE_EXECUTABLE_PATH: executable,
        DOCX_PREVIEW_TIMEOUT_MS: '1000',
      }),
    );
    await expect(service.convert(Buffer.from('document'))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    const pid = Number(await readFile(join(fixtures, 'directories.jsonl.child'), 'utf8'));
    // A killed orphan can briefly be a zombie until the OS reaps it; it must
    // not remain a running or sleeping conversion process.
    let childIsRunning = false;
    try {
      const state = execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], {
        encoding: 'utf8',
      }).trim();
      childIsRunning = state.length > 0 && !state.startsWith('Z');
    } catch {
      // ps exits nonzero once the process has been reaped.
    }
    expect(childIsRunning).toBe(false);
    for (const directory of await directories()) await expect(access(directory)).rejects.toThrow();
    delete process.env.PREVIEW_FIXTURE_MODE;
    await expect(service.convert(Buffer.from('retry'))).resolves.toBeInstanceOf(Buffer);
  });

  it('cancels active process groups on application shutdown', async () => {
    process.env.PREVIEW_FIXTURE_MODE = 'hang';
    const pending = service.convert(Buffer.from('document'));
    // Install the rejection handler before shutdown cancels the child.
    const rejected = expect(pending).rejects.toBeInstanceOf(ServiceUnavailableException);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        await access(join(fixtures, 'directories.jsonl.child'));
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    service.onModuleDestroy();
    await rejected;
    for (const directory of await directories()) await expect(access(directory)).rejects.toThrow();
  });

  it('rejects empty or oversized inputs without starting the converter', async () => {
    await expect(service.convert(Buffer.alloc(0))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.convert(Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(access(join(fixtures, 'directories.jsonl'))).rejects.toThrow();
  });
});
