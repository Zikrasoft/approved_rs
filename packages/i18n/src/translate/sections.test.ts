import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDocument, stringify } from 'yaml';
import { z } from 'zod';
import {
  createSectionTranslator,
  hashSource,
  type Section,
} from './sections.ts';
import {
  stubOpenAiResponse,
  stubOpenAiFetch,
  openAiErrorResponse,
} from './mockOpenAiFetch.ts';

const { translateSection, processSection, recordHashes, run } =
  createSectionTranslator({
    targetLocales: ['en', 'sr'] as const,
    languageName: { en: 'English', sr: 'Serbian (Latin script)' },
    businessDescription: 'a test business',
  });

const navSchema = z
  .object({
    nav: z.object({ home: z.string(), cases: z.string() }).strict(),
    footer: z.object({ tagline: z.string() }).strict(),
  })
  .strict();

const RU_NAV = {
  nav: { home: 'Главная', cases: 'Кейсы' },
  footer: { tagline: 'Слоган' },
};

const NAV_SECTION: Section = {
  path: '',
  fields: ['nav', 'footer'],
  schema: navSchema,
  promptSubject: 'UI copy',
};

const faqSchema = z
  .object({
    general: z.array(z.object({ q: z.string(), a: z.string() }).strict()),
    cityExpert: z.object({ q: z.string(), a: z.string() }).strict(),
  })
  .strict();

const RU_FAQ = {
  general: [{ q: 'Сколько это стоит?', a: 'По запросу.' }],
  cityExpert: { q: 'Эксперт в городе?', a: 'Да.' },
};

const FAQ_SECTION: Section = {
  path: '',
  fields: ['general', 'cityExpert'],
  schema: faqSchema,
  promptSubject: 'FAQ entries',
};

function upper<T>(v: T): T {
  if (typeof v === 'string') return v.toUpperCase() as T;
  if (Array.isArray(v)) return v.map(upper) as T;
  if (typeof v === 'object' && v !== null) {
    return Object.fromEntries(
      Object.entries(v).map(([k, vv]) => [k, upper(vv)]),
    ) as T;
  }
  return v;
}

describe('hashSource', () => {
  it('is stable for the same object', () => {
    expect(hashSource({ nav: { home: 'Главная' } })).toBe(
      hashSource({ nav: { home: 'Главная' } }),
    );
  });

  it('changes when a deeply nested leaf changes', () => {
    expect(hashSource({ nav: { home: 'Главная' } })).not.toBe(
      hashSource({ nav: { home: 'Главная страница' } }),
    );
  });

  it('changes when a key is added or removed', () => {
    expect(hashSource({ nav: { home: 'Главная' } })).not.toBe(
      hashSource({ nav: { home: 'Главная', cases: 'Кейсы' } }),
    );
  });
});

describe('translateSection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('translates a nested section and validates the response', async () => {
    const translated = upper(RU_NAV);
    stubOpenAiResponse(translated);
    await expect(
      translateSection(RU_NAV, 'en', 'test-key', NAV_SECTION),
    ).resolves.toEqual(translated);
  });

  it('translates an array-of-objects section and validates the response', async () => {
    const translated = upper(RU_FAQ);
    stubOpenAiResponse(translated);
    await expect(
      translateSection(RU_FAQ, 'en', 'test-key', FAQ_SECTION),
    ).resolves.toEqual(translated);
  });

  it('names the target language in the prompt rather than the locale code', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(upper(RU_NAV)) } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await translateSection(RU_NAV, 'sr', 'test-key', NAV_SECTION);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      messages: { content: string }[];
    };
    expect(body.messages[0].content).toContain('Serbian (Latin script)');
    expect(body.messages[0].content).toContain('a test business');
  });

  it('throws when the response has a leaf of the wrong type', async () => {
    stubOpenAiResponse({ ...upper(RU_NAV), footer: { tagline: 42 } });
    await expect(
      translateSection(RU_NAV, 'en', 'test-key', NAV_SECTION),
    ).rejects.toThrow();
  });

  it('throws when a translated string contains raw HTML the source did not have', async () => {
    stubOpenAiResponse({
      ...upper(RU_NAV),
      footer: { tagline: '<script>alert(1)</script>' },
    });
    await expect(
      translateSection(RU_NAV, 'en', 'test-key', NAV_SECTION),
    ).rejects.toThrow(/tagline/);
  });

  it('throws when the OpenAI call itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => openAiErrorResponse('boom', 500)),
    );
    await expect(
      translateSection(RU_NAV, 'en', 'test-key', NAV_SECTION),
    ).rejects.toThrow(/boom/);
  });
});

describe('processSection (file round-trip)', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'i18n-section-test-'));
    file = join(dir, 'section.yaml');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function stubTranslateFetch() {
    stubOpenAiFetch((userContent) => upper(JSON.parse(userContent)));
  }

  it('translates every target locale on first run and writes the hash back', async () => {
    stubTranslateFetch();
    writeFileSync(file, stringify({ ...RU_NAV, translations: {} }));

    await expect(
      processSection({ ...NAV_SECTION, path: file }, 'test-key'),
    ).resolves.toBe('translated');

    const doc = parseDocument(readFileSync(file, 'utf-8'));
    expect(doc.getIn(['translations', 'en', 'nav', 'cases'])).toBe('КЕЙСЫ');
    expect(doc.getIn(['translations', 'sr', 'nav', 'cases'])).toBe('КЕЙСЫ');
    expect(typeof doc.get('translatedFrom')).toBe('string');
    expect(doc.getIn(['nav', 'cases'])).toBe('Кейсы');
  });

  it('skips on a second run with no ru changes', async () => {
    stubTranslateFetch();
    writeFileSync(file, stringify({ ...RU_NAV, translations: {} }));
    const section = { ...NAV_SECTION, path: file };

    await processSection(section, 'test-key');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(processSection(section, 'test-key')).resolves.toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('records the hash without translating for a file that predates hash tracking', async () => {
    writeFileSync(
      file,
      stringify({
        ...RU_NAV,
        translations: { en: upper(RU_NAV), sr: upper(RU_NAV) },
      }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      processSection({ ...NAV_SECTION, path: file }, 'test-key'),
    ).resolves.toBe('backfilled');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      parseDocument(readFileSync(file, 'utf-8')).get('translatedFrom'),
    ).toBeTruthy();
  });

  it('translates an array-of-objects section end to end', async () => {
    stubTranslateFetch();
    writeFileSync(file, stringify({ ...RU_FAQ, translations: {} }));

    await expect(
      processSection({ ...FAQ_SECTION, path: file }, 'test-key'),
    ).resolves.toBe('translated');

    const doc = parseDocument(readFileSync(file, 'utf-8'));
    expect(doc.getIn(['translations', 'en', 'general', 0, 'q'])).toBe(
      'СКОЛЬКО ЭТО СТОИТ?',
    );
    expect(doc.getIn(['translations', 'en', 'cityExpert', 'q'])).toBe(
      'ЭКСПЕРТ В ГОРОДЕ?',
    );
  });

  it('throws instead of writing when ru itself fails schema validation', async () => {
    writeFileSync(file, 'nav:\n  home: Главная\ntranslations: {}\n');
    await expect(
      processSection({ ...NAV_SECTION, path: file }, 'test-key'),
    ).rejects.toThrow();
  });
});

describe('run', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'i18n-run-test-'));
    file = join(dir, 'section.yaml');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('fails without an API key rather than silently doing nothing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(run([])).resolves.toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      'Missing env var: OPENAI_API_KEY',
    );
  });

  it('reports every outcome and exits 0 when nothing failed', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    stubOpenAiFetch((userContent) => upper(JSON.parse(userContent)));
    writeFileSync(file, stringify({ ...RU_NAV, translations: {} }));
    const section = { ...NAV_SECTION, path: file };

    await expect(run([section])).resolves.toBe(0);
    await expect(run([section])).resolves.toBe(0);

    const messages = vi.mocked(console.log).mock.calls.map((c) => c[0]);
    expect(messages.some((m) => String(m).startsWith('✓'))).toBe(true);
    expect(messages.some((m) => String(m).startsWith('-'))).toBe(true);
  });

  it('reports the backfill outcome', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    writeFileSync(
      file,
      stringify({
        ...RU_NAV,
        translations: { en: upper(RU_NAV), sr: upper(RU_NAV) },
      }),
    );

    await expect(run([{ ...NAV_SECTION, path: file }])).resolves.toBe(0);

    const messages = vi.mocked(console.log).mock.calls.map((c) => c[0]);
    expect(messages.some((m) => String(m).startsWith('~'))).toBe(true);
  });

  it('keeps going after a failing section and exits 1', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    stubOpenAiFetch((userContent) => upper(JSON.parse(userContent)));
    writeFileSync(file, 'nav:\n  home: Главная\ntranslations: {}\n');
    const good = join(dir, 'good.yaml');
    writeFileSync(good, stringify({ ...RU_NAV, translations: {} }));

    await expect(
      run([
        { ...NAV_SECTION, path: file },
        { ...NAV_SECTION, path: good },
      ]),
    ).resolves.toBe(1);

    expect(console.error).toHaveBeenCalled();
    expect(
      parseDocument(readFileSync(good, 'utf-8')).get('translatedFrom'),
    ).toBeTruthy();
  });
});

describe('recordHashes', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'i18n-rehash-test-'));
    file = join(dir, 'section.yaml');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('stamps the current hash without calling the API', () => {
    writeFileSync(
      file,
      stringify({
        ...RU_NAV,
        translations: { en: upper(RU_NAV), sr: upper(RU_NAV) },
      }),
    );

    expect(recordHashes([{ ...NAV_SECTION, path: file }])).toBe(1);
    expect(
      parseDocument(readFileSync(file, 'utf-8')).get('translatedFrom'),
    ).toBe(hashSource(RU_NAV));
  });

  it('leaves a file whose hash is already current untouched', () => {
    writeFileSync(
      file,
      stringify({
        ...RU_NAV,
        translations: {},
        translatedFrom: hashSource(RU_NAV),
      }),
    );
    const before = readFileSync(file, 'utf-8');

    expect(recordHashes([{ ...NAV_SECTION, path: file }])).toBe(0);
    expect(readFileSync(file, 'utf-8')).toBe(before);
  });

  it('throws instead of stamping a hash over malformed ru content', () => {
    writeFileSync(file, 'nav:\n  home: Главная\ntranslations: {}\n');
    expect(() => recordHashes([{ ...NAV_SECTION, path: file }])).toThrow();
  });
});
