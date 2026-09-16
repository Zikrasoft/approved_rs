import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDocument, stringify } from 'yaml';
import { createCaseTranslator, hashSource, splitFrontmatter } from './cases.ts';
import { loadCache, type CacheFile } from './leafCache.ts';
import {
  openAiChatResponse,
  sentPayloads,
  stubOpenAiFetch,
  stubTranslate,
  systemPrompts,
} from './mockOpenAiFetch.ts';

const RU_CASE = { title: 'Honda Accord', body: 'Полное описание кейса.' };

let dir: string;
let cachePath: string;

function translator(
  extraFields: readonly string[] = [],
  businessDescription = 'a test business',
) {
  return createCaseTranslator({
    targetLocales: ['en', 'sr'] as const,
    languageName: { en: 'English', sr: 'Serbian (Latin script)' },
    businessDescription,
    subject: 'car case studies',
    extraFields,
    cachePath,
  });
}

function caseFile(
  name = 'honda-accord',
  frontmatter: Record<string, unknown> = { title: RU_CASE.title },
  body = RU_CASE.body,
): string {
  const caseDir = join(dir, name);
  mkdirSync(caseDir, { recursive: true });
  const file = join(caseDir, 'index.md');
  writeFileSync(
    file,
    `---\n${stringify(frontmatter).trimEnd()}\n---\n${body}\n`,
  );
  return file;
}

function rewriteFrontmatter(
  file: string,
  mutate: (data: Record<string, unknown>) => void,
): void {
  const { frontmatter, body } = splitFrontmatter(readFileSync(file, 'utf-8'));
  const doc = parseDocument(frontmatter);
  const data = doc.toJS() as Record<string, unknown>;
  mutate(data);
  writeFileSync(file, `---\n${stringify(data).trimEnd()}\n---\n${body}`);
}

const frontmatterOf = (file: string) =>
  parseDocument(
    splitFrontmatter(readFileSync(file, 'utf-8')).frontmatter,
  ).toJS() as Record<string, unknown>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cases-'));
  cachePath = join(dir, 'translations.cache.json');
});

afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

describe('hashSource', () => {
  it('is stable for the same title/body', () => {
    expect(hashSource(RU_CASE)).toBe(hashSource({ ...RU_CASE }));
  });

  it('changes when the body changes', () => {
    expect(hashSource(RU_CASE)).not.toBe(
      hashSource({ ...RU_CASE, body: 'Другое описание.' }),
    );
  });

  it('matches the pre-extraFields hash when no extras are given', () => {
    expect(hashSource({ ...RU_CASE, car: 'Honda Accord' }, [])).toBe(
      hashSource(RU_CASE),
    );
  });

  it('changes when only an extra value changes', () => {
    expect(hashSource({ ...RU_CASE, car: 'A' }, ['car'])).not.toBe(
      hashSource({ ...RU_CASE, car: 'B' }, ['car']),
    );
  });
});

describe('splitFrontmatter', () => {
  it('splits frontmatter from body', () => {
    expect(splitFrontmatter('---\ntitle: X\n---\nBody text\n')).toEqual({
      frontmatter: 'title: X',
      body: 'Body text\n',
    });
  });

  it('throws when there is no frontmatter', () => {
    expect(() => splitFrontmatter('Body only')).toThrow('no frontmatter found');
  });
});

describe('processFile', () => {
  it('translates a case on first run and writes the hash back', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = caseFile();
    const { processFile } = translator();

    expect(await processFile(file, 'key', {})).toBe('translated');

    const written = frontmatterOf(file);
    expect(written.translatedFrom).toBe(hashSource(RU_CASE));
    expect(written.translations).toEqual({
      en: { title: 't:Honda Accord', body: 't:Полное описание кейса.' },
      sr: { title: 't:Honda Accord', body: 't:Полное описание кейса.' },
    });
    expect(readFileSync(file, 'utf-8')).toContain(`\n---\n${RU_CASE.body}\n`);
  });

  it('makes no request and does not reopen the file for write on the second run', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = caseFile();
    const { processFile } = translator();
    const cache: CacheFile = {};
    await processFile(file, 'key', cache);
    const afterFirst = readFileSync(file, 'utf-8');

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    const before = statSync(file).mtimeMs;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await processFile(file, 'key', cache)).toBe('skipped');
    expect(sentPayloads()).toEqual([]);
    expect(readFileSync(file, 'utf-8')).toBe(afterFirst);
    expect(statSync(file).mtimeMs).toBe(before);
  });

  it('sends the title alone when only the title changed', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = caseFile();
    const { processFile } = translator();
    const cache: CacheFile = {};
    await processFile(file, 'key', cache);

    rewriteFrontmatter(file, (data) => {
      data.title = 'Honda Accord 2019';
    });

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await processFile(file, 'key', cache)).toBe('translated');
    expect(sentPayloads()).toEqual([
      { title: 'Honda Accord 2019' },
      { title: 'Honda Accord 2019' },
    ]);
  });

  it('drops cache entries for Russian the case no longer holds', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = caseFile();
    const { processFile } = translator();
    const cache: CacheFile = {};
    await processFile(file, 'key', cache);
    expect(Object.keys(cache[file] as object)).toHaveLength(4);

    rewriteFrontmatter(file, (data) => {
      data.title = 'Другой заголовок';
    });

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    await processFile(file, 'key', cache);
    expect(Object.keys(cache[file] as object)).toHaveLength(4);
    expect(Object.values(cache[file] as object)).not.toContain(
      't:Honda Accord',
    );
  });

  it('adopts what is committed when it first meets a case with a current hash', async () => {
    stubTranslate((text) => `t:${text}`);
    const translated = {
      title: 'Honda Accord',
      body: 'Full case description.',
    };
    const file = caseFile('honda-accord', {
      title: RU_CASE.title,
      translations: { en: translated, sr: translated },
      translatedFrom: hashSource(RU_CASE),
    });
    const { processFile } = translator();
    const cache: CacheFile = {};

    expect(await processFile(file, 'key', cache)).toBe('skipped');
    expect(sentPayloads()).toEqual([]);
    expect(Object.values(cache[file] as Record<string, string>)).toContain(
      'Full case description.',
    );
  });

  it.each([
    ['no title at all', {}, 'Full case description.'],
    ['an empty title', { title: '   ' }, 'Full case description.'],
    ['an empty body', { title: RU_CASE.title }, '   '],
  ])(
    'leaves a case with %s untranslated instead of failing the run',
    async (_l, front, body) => {
      stubTranslate((text) => `t:${text}`);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const file = caseFile('broken', front, body);
      const before = readFileSync(file, 'utf-8');
      expect(await translator().processFile(file, 'key', {})).toBe('skipped');
      expect(sentPayloads()).toEqual([]);
      expect(readFileSync(file, 'utf-8')).toBe(before);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('title or body is empty'),
      );
      warn.mockRestore();
    },
  );

  it('regenerates a case whose cache block predates the prompt change', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = caseFile();
    const cache: CacheFile = {};
    await translator().processFile(file, 'key', cache);

    vi.unstubAllGlobals();
    stubTranslate((text) => `v2:${text}`);
    expect(
      await translator([], 'a different business').processFile(
        file,
        'key',
        cache,
      ),
    ).toBe('translated');
    expect(
      (frontmatterOf(file).translations as Record<string, { title: string }>).en
        ?.title,
    ).toBe('v2:Honda Accord');
  });

  it('keeps paid-for entries when a later locale fails', async () => {
    let call = 0;
    stubOpenAiFetch((content) => {
      call += 1;
      const payload = JSON.parse(content) as Record<string, string>;
      if (call <= 1)
        return Object.fromEntries(
          Object.keys(payload).map((path) => [path, 'en']),
        );
      return Object.fromEntries(
        Object.keys(payload).map((path) => [path, 'Srпски']),
      );
    });
    const file = caseFile();
    const cache: CacheFile = {};

    await expect(translator().processFile(file, 'key', cache)).rejects.toThrow(
      'mixes Latin and Cyrillic',
    );
    expect(Object.values(cache[file] ?? {})).toContain('en');
  });

  it('rejects a response that leaves a field blank', async () => {
    stubOpenAiFetch(() => ({ title: 'Ok', body: '   ' }));
    const file = caseFile();
    const { processFile } = translator();
    await expect(processFile(file, 'key', {})).rejects.toThrow(
      'came back blank',
    );
  });

  it('does not adopt translations whose hash says they are stale', async () => {
    stubTranslate((text) => `t:${text}`);
    const stale = { title: 'Old', body: 'Old' };
    const file = caseFile('honda-accord', {
      title: RU_CASE.title,
      translations: { en: stale, sr: stale },
      translatedFrom: 'stale',
    });
    const { processFile } = translator();
    expect(await processFile(file, 'key', {})).toBe('translated');
    expect(
      (frontmatterOf(file).translations as Record<string, { title: string }>).en
        ?.title,
    ).toBe('t:Honda Accord');
  });

  it('discards a cache entry that would not have passed as a fresh one', async () => {
    stubTranslate((text) => `t:${text}`);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const file = caseFile();
    const { processFile } = translator();
    const cache: CacheFile = {};
    await processFile(file, 'key', cache);

    rewriteFrontmatter(file, (data) => {
      delete data.translations;
    });
    const block = cache[file] as Record<string, string>;
    const key = Object.keys(block)[0] as string;
    block[key] = '<script>alert(1)</script>';

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await processFile(file, 'key', cache)).toBe('translated');
    expect(JSON.stringify(frontmatterOf(file).translations)).not.toContain(
      '<script>',
    );
    warn.mockRestore();
  });

  it('names the language, the business and the subject in the prompt', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = caseFile();
    await translator().processFile(file, 'key', {});
    expect(systemPrompts()[0]).toContain('English');
    expect(systemPrompts()[0]).toContain('a test business');
    expect(systemPrompts()[0]).toContain('car case studies');
    expect(systemPrompts()[1]).toContain('Serbian (Latin script)');
  });
});

describe('extraFields', () => {
  it('translates an extra field alongside title and body', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = caseFile('bmw', {
      title: RU_CASE.title,
      car: 'БМВ Х3',
    });
    expect(await translator(['car']).processFile(file, 'key', {})).toBe(
      'translated',
    );
    expect(
      (frontmatterOf(file).translations as Record<string, { car: string }>).en
        ?.car,
    ).toBe('t:БМВ Х3');
  });

  it('explains the car field in the prompt', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = caseFile('bmw', { title: RU_CASE.title, car: 'БМВ Х3' });
    await translator(['car']).processFile(file, 'key', {});
    expect(systemPrompts()[0]).toContain('vehicle make and model');
  });

  it('leaves the guidance out when the file has no extra to translate', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = caseFile();
    await translator(['car']).processFile(file, 'key', {});
    expect(systemPrompts()[0]).not.toContain('vehicle make and model');
  });

  it('says nothing about an extra field it has no guidance for', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = caseFile('bmw', {
      title: RU_CASE.title,
      car: 'БМВ Х3',
      price: '12000 EUR',
    });
    await translator(['car', 'price']).processFile(file, 'key', {});
    expect(systemPrompts()[0]).not.toContain('undefined');
  });

  it('ignores a blank extra value', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = caseFile('bmw', { title: RU_CASE.title, car: '   ' });
    await translator(['car']).processFile(file, 'key', {});
    expect(sentPayloads()[0]).not.toHaveProperty('car');
  });

  it('asks only for the extra a stored translation is missing', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = caseFile('bmw', { title: RU_CASE.title, car: 'БМВ Х3' });
    const { processFile } = translator(['car']);
    const cache: CacheFile = {};
    await processFile(file, 'key', cache);

    rewriteFrontmatter(file, (data) => {
      const translations = data.translations as Record<
        string,
        Record<string, string>
      >;
      delete translations.en!.car;
    });

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await processFile(file, 'key', cache)).toBe('backfilled');
    expect(sentPayloads()).toEqual([]);
    expect(
      (frontmatterOf(file).translations as Record<string, { car: string }>).en
        ?.car,
    ).toBe('t:БМВ Х3');
  });

  it('rejects a response that omits an extra field', async () => {
    stubOpenAiFetch(() => ({ title: 'Ok', body: 'Ok' }));
    const file = caseFile('bmw', { title: RU_CASE.title, car: 'БМВ Х3' });
    await expect(
      translator(['car']).processFile(file, 'key', {}),
    ).rejects.toThrow('translated response for "car" is missing');
  });
});

describe('run', () => {
  const OLD_KEY = process.env.OPENAI_API_KEY;

  afterEach(() => {
    process.env.OPENAI_API_KEY = OLD_KEY;
    vi.restoreAllMocks();
  });

  it('fails without an API key', async () => {
    delete process.env.OPENAI_API_KEY;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await translator().run([dir])).toBe(1);
    expect(error).toHaveBeenCalledWith('Missing env var: OPENAI_API_KEY');
  });

  it('walks every case directory, writes the cache and reuses it', async () => {
    process.env.OPENAI_API_KEY = 'key';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    stubTranslate((text) => `t:${text}`);
    const file = caseFile();

    expect(await translator().run([dir])).toBe(0);
    expect(Object.keys(loadCache(cachePath))).toEqual([file]);

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await translator().run([dir])).toBe(0);
    expect(sentPayloads()).toEqual([]);
  });

  it('reports the run that restored a translation without asking for it', async () => {
    process.env.OPENAI_API_KEY = 'key';
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    stubTranslate((text) => `t:${text}`);
    const file = caseFile();
    await translator().run([dir]);

    rewriteFrontmatter(file, (data) => {
      delete data.translations;
    });

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await translator().run([dir])).toBe(0);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('no translation needed'),
    );
  });

  it('refuses to start on a cache it cannot read, without crashing', async () => {
    process.env.OPENAI_API_KEY = 'key';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    writeFileSync(cachePath, '{not json');
    expect(await translator().run([dir])).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining(cachePath));
  });

  it('keeps going after a broken case file and exits 1', async () => {
    process.env.OPENAI_API_KEY = 'key';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(openAiChatResponse({ title: '', body: '' })),
    );
    caseFile();
    expect(await translator().run([dir])).toBe(1);
    expect(error).toHaveBeenCalled();
  });

  it('keeps the entries of an earlier file when a later one fails', async () => {
    process.env.OPENAI_API_KEY = 'key';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const good = caseFile('aaa-good');
    caseFile('zzz-bad');
    let call = 0;
    stubOpenAiFetch((content) => {
      call += 1;
      const payload = JSON.parse(content) as Record<string, string>;
      if (call > 2) return { title: '', body: '' };
      return Object.fromEntries(
        Object.entries(payload).map(([path, text]) => [path, `t:${text}`]),
      );
    });

    expect(await translator().run([dir])).toBe(1);
    expect(Object.keys(loadCache(cachePath))).toContain(good);
  });

  it('forgets a case that no longer exists, but only on a clean run', async () => {
    process.env.OPENAI_API_KEY = 'key';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    stubTranslate((text) => `t:${text}`);
    const gone = caseFile('gone');
    await translator().run([dir]);
    expect(Object.keys(loadCache(cachePath))).toContain(gone);

    rmSync(join(dir, 'gone'), { recursive: true });
    caseFile('stays');
    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    await translator().run([dir]);
    expect(Object.keys(loadCache(cachePath))).not.toContain(gone);
  });

  it('leaves a vanished case in the cache when the run had a failure', async () => {
    process.env.OPENAI_API_KEY = 'key';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubTranslate((text) => `t:${text}`);
    const gone = caseFile('gone');
    await translator().run([dir]);

    rmSync(join(dir, 'gone'), { recursive: true });
    caseFile('stays');
    vi.unstubAllGlobals();
    stubOpenAiFetch(() => ({ title: '', body: '' }));
    expect(await translator().run([dir])).toBe(1);
    expect(Object.keys(loadCache(cachePath))).toContain(gone);
  });
});
