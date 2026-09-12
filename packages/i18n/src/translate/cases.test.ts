import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { createCaseTranslator, hashSource, splitFrontmatter } from './cases.ts';
import { stubOpenAiResponse, stubOpenAiFetch } from './mockOpenAiFetch.ts';

const { translateCase, processFile, run } = createCaseTranslator({
  targetLocales: ['en', 'sr'] as const,
  languageName: { en: 'English', sr: 'Serbian (Latin script)' },
  businessDescription: 'a test business',
  subject: 'car case studies',
});

const RU_CASE = { title: 'Honda Accord', body: 'Полное описание кейса.' };

function caseFile(dir: string): string {
  const caseDir = join(dir, 'honda-accord');
  mkdirSync(caseDir, { recursive: true });
  const file = join(caseDir, 'index.md');
  writeFileSync(
    file,
    `---\ntitle: ${RU_CASE.title}\ntranslations: {}\n---\n${RU_CASE.body}\n`,
  );
  return file;
}

describe('hashSource', () => {
  it('is stable for the same title/body', () => {
    expect(hashSource(RU_CASE)).toBe(hashSource({ ...RU_CASE }));
  });

  it('changes when the body changes', () => {
    expect(hashSource(RU_CASE)).not.toBe(
      hashSource({ ...RU_CASE, body: 'Другой текст.' }),
    );
  });
});

describe('splitFrontmatter', () => {
  it('splits frontmatter from body', () => {
    const { frontmatter, body } = splitFrontmatter(
      '---\ntitle: X\n---\nBody text\n',
    );
    expect(frontmatter).toBe('title: X');
    expect(body).toBe('Body text\n');
  });

  it('throws when there is no frontmatter', () => {
    expect(() => splitFrontmatter('no frontmatter here')).toThrow(
      /no frontmatter/,
    );
  });
});

describe('translateCase', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('translates title/body and validates the response', async () => {
    stubOpenAiResponse({ title: 'Honda Accord', body: 'Full case writeup.' });
    await expect(translateCase(RU_CASE, 'en', 'test-key')).resolves.toEqual({
      title: 'Honda Accord',
      body: 'Full case writeup.',
    });
  });

  it('names the target language and the business in the prompt', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({ title: 'X', body: 'Y' }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await translateCase(RU_CASE, 'sr', 'test-key');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      messages: { content: string }[];
    };
    expect(body.messages[0].content).toContain('Serbian (Latin script)');
    expect(body.messages[0].content).toContain('a test business');
    expect(body.messages[0].content).toContain('car case studies');
  });

  it('throws when the response is missing title or body', async () => {
    stubOpenAiResponse({ title: 'Honda Accord' });
    await expect(translateCase(RU_CASE, 'en', 'test-key')).rejects.toThrow(
      /missing title\/body/,
    );
  });

  it('throws when the translated body contains raw HTML (stored-XSS guard)', async () => {
    stubOpenAiResponse({
      title: 'Honda Accord',
      body: '<img src=x onerror=alert(1)>',
    });
    await expect(translateCase(RU_CASE, 'en', 'test-key')).rejects.toThrow(
      /body/,
    );
  });
});

describe('processFile (file round-trip)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cases-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function stubTranslateFetch() {
    stubOpenAiFetch((userContent) => {
      const title = /Title: (.*)/.exec(userContent)?.[1] ?? '';
      return { title: title.toUpperCase(), body: 'TRANSLATED BODY' };
    });
  }

  it('translates a case on first run and writes the hash back', async () => {
    stubTranslateFetch();
    const file = caseFile(dir);

    await expect(processFile(file, 'test-key')).resolves.toBe('translated');

    const { frontmatter } = splitFrontmatter(readFileSync(file, 'utf-8'));
    const doc = parseDocument(frontmatter);
    expect(doc.getIn(['translations', 'en', 'title'])).toBe(
      RU_CASE.title.toUpperCase(),
    );
    expect(doc.getIn(['translations', 'sr', 'body'])).toBe('TRANSLATED BODY');
    expect(typeof doc.get('translatedFrom')).toBe('string');
  });

  it('skips on a second run with no ru changes', async () => {
    stubTranslateFetch();
    const file = caseFile(dir);

    await processFile(file, 'test-key');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(processFile(file, 'test-key')).resolves.toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('records the hash without translating for a case that predates hash tracking', async () => {
    const caseDir = join(dir, 'old-case');
    mkdirSync(caseDir, { recursive: true });
    const file = join(caseDir, 'index.md');
    writeFileSync(
      file,
      `---\ntitle: ${RU_CASE.title}\ntranslations:\n  en:\n    title: A\n    body: B\n  sr:\n    title: C\n    body: D\n---\n${RU_CASE.body}\n`,
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(processFile(file, 'test-key')).resolves.toBe('backfilled');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('run', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cases-run-test-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('fails without an API key', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(run([dir])).resolves.toBe(1);
  });

  it('walks every case directory and exits 0', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    stubOpenAiFetch((userContent) => ({
      title: (/Title: (.*)/.exec(userContent)?.[1] ?? '').toUpperCase(),
      body: 'TRANSLATED BODY',
    }));
    caseFile(dir);
    writeFileSync(join(dir, 'not-a-case.txt'), 'ignored');

    await expect(run([dir])).resolves.toBe(0);
    await expect(run([dir])).resolves.toBe(0);
  });

  it('reports the backfill outcome', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const caseDir = join(dir, 'old-case');
    mkdirSync(caseDir, { recursive: true });
    writeFileSync(
      join(caseDir, 'index.md'),
      `---\ntitle: ${RU_CASE.title}\ntranslations:\n  en:\n    title: A\n    body: B\n  sr:\n    title: C\n    body: D\n---\n${RU_CASE.body}\n`,
    );

    await expect(run([dir])).resolves.toBe(0);

    const messages = vi.mocked(console.log).mock.calls.map((c) => c[0]);
    expect(messages.some((m) => String(m).startsWith('~'))).toBe(true);
  });

  it('keeps going after a broken case file and exits 1', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    stubOpenAiFetch(() => ({ title: 'X', body: 'Y' }));
    const brokenDir = join(dir, 'broken');
    mkdirSync(brokenDir, { recursive: true });
    writeFileSync(join(brokenDir, 'index.md'), 'no frontmatter at all');
    caseFile(dir);

    await expect(run([dir])).resolves.toBe(1);
    expect(console.error).toHaveBeenCalled();
  });
});
