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
import {
  stubOpenAiResponse,
  stubOpenAiFetch,
  openAiChatResponse,
} from './mockOpenAiFetch.ts';

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

const LEGACY_HASH = '504a66f98ac4d994';

const LEGACY_SYSTEM_PROMPT =
  'You translate car case studies from Russian into Serbian (Latin script) ' +
  'for a test business. ' +
  'Translate the MEANING naturally and idiomatically, the way a native speaker would actually write ' +
  'this case study — never a literal word-for-word translation. Keep markdown formatting (headings, ' +
  'bold, lists) intact. Keep car makes/models, prices, and place names as they would normally appear ' +
  'in the target language. Respond with a JSON object: {"title": string, "body": string}.';

describe('hashSource', () => {
  it('is stable for the same title/body', () => {
    expect(hashSource(RU_CASE)).toBe(hashSource({ ...RU_CASE }));
  });

  it('changes when the body changes', () => {
    expect(hashSource(RU_CASE)).not.toBe(
      hashSource({ ...RU_CASE, body: 'Другой текст.' }),
    );
  });

  it('matches the pre-extraFields hash when no extras are given', () => {
    expect(hashSource(RU_CASE)).toBe(LEGACY_HASH);
    expect(hashSource({ ...RU_CASE, car: 'Honda Accord' }, [])).toBe(
      LEGACY_HASH,
    );
  });

  it('changes when only an extra value changes', () => {
    const source = { ...RU_CASE, car: 'Пригнан под заказ из Германии' };
    expect(hashSource(source, ['car'])).not.toBe(LEGACY_HASH);
    expect(hashSource(source, ['car'])).not.toBe(
      hashSource({ ...source, car: 'Honda Accord' }, ['car']),
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

  it('builds the pre-extraFields prompt verbatim when no extras are given', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        openAiChatResponse({ title: 'X', body: 'Y' }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await translateCase(RU_CASE, 'sr', 'test-key');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      messages: { content: string }[];
    };
    expect(body.messages[0].content).toBe(LEGACY_SYSTEM_PROMPT);
    expect(body.messages[1].content).toBe(
      `Title: ${RU_CASE.title}\n\nBody:\n${RU_CASE.body}`,
    );
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

describe('extraFields', () => {
  const extra = createCaseTranslator({
    targetLocales: ['en', 'sr'] as const,
    languageName: { en: 'English', sr: 'Serbian (Latin script)' },
    businessDescription: 'a test business',
    subject: 'car case studies',
    extraFields: ['car', 'subtitle'],
  });

  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cases-extra-test-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function writeCase(name: string, frontmatter: string): string {
    const caseDir = join(dir, name);
    mkdirSync(caseDir, { recursive: true });
    const file = join(caseDir, 'index.md');
    writeFileSync(file, `---\n${frontmatter}\n---\n${RU_CASE.body}\n`);
    return file;
  }

  function stubEchoFetch() {
    stubOpenAiFetch((userContent) => ({
      title: 'TITLE',
      body: 'BODY',
      car: `CAR:${/car: (.*)/.exec(userContent)?.[1] ?? ''}`,
      subtitle: 'SUBTITLE',
    }));
  }

  function frontmatterOf(file: string) {
    return parseDocument(
      splitFrontmatter(readFileSync(file, 'utf-8')).frontmatter,
    );
  }

  it('translates an extra field and writes it into the translations node', async () => {
    stubEchoFetch();
    const file = writeCase(
      'with-car',
      `title: ${RU_CASE.title}\ncar: Пригнан под заказ из Германии\ntranslations: {}`,
    );

    await expect(extra.processFile(file, 'test-key')).resolves.toBe(
      'translated',
    );

    const doc = frontmatterOf(file);
    expect(doc.getIn(['translations', 'en', 'car'])).toBe(
      'CAR:Пригнан под заказ из Германии',
    );
    expect(doc.getIn(['translations', 'sr', 'title'])).toBe('TITLE');
    expect(doc.getIn(['translations', 'sr', 'subtitle'])).toBeUndefined();
  });

  it('asks for the extra fields and explains the car field in the prompt', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      openAiChatResponse({
        title: 'T',
        body: 'B',
        car: 'C',
        subtitle: 'S',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await extra.translateCase(
      { ...RU_CASE, car: 'Honda Accord', subtitle: 'Кузовной ремонт' },
      'sr',
      'test-key',
      ['car', 'subtitle'],
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      messages: { content: string }[];
    };
    expect(body.messages[0].content).toContain(
      '{"title": string, "body": string, "car": string, "subtitle": string}',
    );
    expect(body.messages[0].content).toContain('vehicle make and model');
    expect(body.messages[1].content).toBe(
      `Title: ${RU_CASE.title}\ncar: Honda Accord\nsubtitle: Кузовной ремонт\n\nBody:\n${RU_CASE.body}`,
    );
  });

  it('skips extras a file does not have while a sibling file keeps them', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    stubEchoFetch();
    const withCar = writeCase(
      'with-car',
      `title: ${RU_CASE.title}\ncar: Honda Accord\ntranslations: {}`,
    );
    const withoutCar = writeCase(
      'without-car',
      `title: ${RU_CASE.title}\ntranslations: {}`,
    );

    await expect(extra.run([dir])).resolves.toBe(0);

    expect(frontmatterOf(withCar).getIn(['translations', 'en', 'car'])).toBe(
      'CAR:Honda Accord',
    );
    expect(
      frontmatterOf(withoutCar).getIn(['translations', 'en', 'car']),
    ).toBeUndefined();
    expect(
      frontmatterOf(withoutCar).getIn(['translations', 'en', 'title']),
    ).toBe('TITLE');
  });

  it('ignores a blank extra value', async () => {
    stubEchoFetch();
    const file = writeCase(
      'blank-car',
      `title: ${RU_CASE.title}\ncar: '   '\ntranslations: {}`,
    );

    await expect(extra.processFile(file, 'test-key')).resolves.toBe(
      'translated',
    );
    expect(
      frontmatterOf(file).getIn(['translations', 'en', 'car']),
    ).toBeUndefined();
  });

  it('re-translates an entry whose stored translation lacks the extra field', async () => {
    stubEchoFetch();
    const file = writeCase(
      'stale',
      `title: ${RU_CASE.title}\ncar: Honda Accord\ntranslatedFrom: ${hashSource(
        { ...RU_CASE, car: 'Honda Accord' },
        ['car'],
      )}\ntranslations:\n  en:\n    title: A\n    body: B\n  sr:\n    title: C\n    body: D`,
    );

    await expect(extra.processFile(file, 'test-key')).resolves.toBe(
      'translated',
    );
    expect(frontmatterOf(file).getIn(['translations', 'en', 'car'])).toBe(
      'CAR:Honda Accord',
    );
  });

  it('throws when the response omits an extra field', async () => {
    stubOpenAiResponse({ title: 'T', body: 'B' });
    await expect(
      extra.translateCase({ ...RU_CASE, car: 'Honda Accord' }, 'en', 'k', [
        'car',
      ]),
    ).rejects.toThrow(/missing car/);
  });

  it('rejects an extra field that introduces HTML the source did not have', async () => {
    stubOpenAiResponse({ title: 'T', body: 'B', car: '<img src=x>' });
    await expect(
      extra.translateCase({ ...RU_CASE, car: 'Honda Accord' }, 'en', 'k', [
        'car',
      ]),
    ).rejects.toThrow(/car/);
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
