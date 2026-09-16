import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDocument, stringify } from 'yaml';
import { z } from 'zod';
import {
  buildSectionPrompt,
  createSectionTranslator,
  type Section,
} from './sections.ts';
import { hashSource } from './hashSource.ts';
import { translationIsCurrent } from '../translationIsCurrent.ts';
import { loadCache, type CacheFile } from './leafCache.ts';
import {
  openAiErrorResponse,
  sentPayloads,
  stubOpenAiFetch,
  stubTranslate,
} from './mockOpenAiFetch.ts';

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

const NAV_SECTION: Omit<Section, 'path'> = {
  fields: ['nav', 'footer'],
  schema: navSchema,
  promptSubject: 'UI copy',
};

let dir: string;
let cachePath: string;

function translator(
  cache = cachePath,
  businessDescription = 'a test business',
) {
  return createSectionTranslator({
    targetLocales: ['en', 'sr'] as const,
    languageName: { en: 'English', sr: 'Serbian (Latin script)' },
    businessDescription,
    cachePath: cache,
  });
}

function writeSection(
  name: string,
  ru: Record<string, unknown> = RU_NAV,
  extra: Record<string, unknown> = {},
): string {
  const file = join(dir, name);
  writeFileSync(file, stringify({ ...ru, ...extra }));
  return file;
}

function section(file: string): Section {
  return { ...NAV_SECTION, path: file };
}

const translationsOf = (file: string) =>
  (parseDocument(readFileSync(file, 'utf-8')).toJS() as Record<string, unknown>)
    .translations as Record<string, Record<string, unknown>>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sections-'));
  cachePath = join(dir, 'translations.cache.json');
});

afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

describe('hashSource', () => {
  it('is stable for the same data and moves when the data does', () => {
    expect(hashSource(RU_NAV)).toBe(hashSource({ ...RU_NAV }));
    expect(hashSource(RU_NAV)).not.toBe(
      hashSource({ ...RU_NAV, footer: { tagline: 'Другой' } }),
    );
  });
});

describe('buildSectionPrompt', () => {
  it('names the subject, the language and the business', () => {
    const prompt = buildSectionPrompt('UI copy', 'German', 'a car service');
    expect(prompt).toContain('UI copy');
    expect(prompt).toContain('German');
    expect(prompt).toContain('a car service');
  });

  it('asks for the flat shape the payload actually uses', () => {
    expect(buildSectionPrompt('x', 'y', 'z')).toContain(
      'EXACTLY the same keys',
    );
  });
});

describe('processSection', () => {
  it('translates every locale on a cold cache and records the hash', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    const { processSection } = translator();
    const cache: CacheFile = {};

    expect(await processSection(section(file), 'key', cache)).toBe(
      'translated',
    );

    const written = parseDocument(readFileSync(file, 'utf-8')).toJS() as Record<
      string,
      unknown
    >;
    expect(written.translatedFrom).toBe(hashSource(RU_NAV));
    expect(translationsOf(file).en).toEqual({
      nav: { home: 't:Главная', cases: 't:Кейсы' },
      footer: { tagline: 't:Слоган' },
    });
    expect(Object.keys(cache[file] as object)).toHaveLength(6);
  });

  it('makes no request and does not reopen the file for write on the second run', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    const { processSection } = translator();
    const cache: CacheFile = {};
    await processSection(section(file), 'key', cache);
    const afterFirst = readFileSync(file, 'utf-8');

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    const before = statSync(file).mtimeMs;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await processSection(section(file), 'key', cache)).toBe('skipped');
    expect(sentPayloads()).toEqual([]);
    expect(readFileSync(file, 'utf-8')).toBe(afterFirst);
    expect(statSync(file).mtimeMs).toBe(before);
  });

  it('sends only the leaf whose Russian changed', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    const { processSection } = translator();
    const cache: CacheFile = {};
    await processSection(section(file), 'key', cache);

    writeFileSync(
      file,
      stringify({
        ...parseDocument(readFileSync(file, 'utf-8')).toJS(),
        footer: { tagline: 'Новый слоган' },
      }),
    );
    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await processSection(section(file), 'key', cache)).toBe(
      'translated',
    );
    expect(sentPayloads()).toEqual([
      { 'footer.tagline': 'Новый слоган' },
      { 'footer.tagline': 'Новый слоган' },
    ]);
  });

  it('adopts what is committed when it first meets a file with a current hash', async () => {
    stubTranslate((text) => `t:${text}`);
    const translated = {
      nav: { home: 'Home', cases: 'Cases' },
      footer: { tagline: 'Tagline' },
    };
    const file = writeSection('home.yaml', RU_NAV, {
      translations: { en: translated, sr: translated },
      translatedFrom: hashSource(RU_NAV),
    });

    const { processSection } = translator();
    const cache: CacheFile = {};
    expect(await processSection(section(file), 'key', cache)).toBe('skipped');
    expect(sentPayloads()).toEqual([]);
    expect(Object.values(cache[file] as Record<string, string>)).toContain(
      'Home',
    );
  });

  it('does not adopt translations whose hash says they are stale', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml', RU_NAV, {
      translations: {
        en: {
          nav: { home: 'Old', cases: 'Old' },
          footer: { tagline: 'Old' },
        },
      },
      translatedFrom: 'stale',
    });

    const { processSection } = translator();
    expect(await processSection(section(file), 'key', {})).toBe('translated');
    expect(translationsOf(file).en).toEqual({
      nav: { home: 't:Главная', cases: 't:Кейсы' },
      footer: { tagline: 't:Слоган' },
    });
  });

  it('keeps a hand-written value and stops asking for it', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    const { processSection } = translator();
    const cache: CacheFile = {};
    await processSection(section(file), 'key', cache);

    const doc = parseDocument(readFileSync(file, 'utf-8')).toJS() as Record<
      string,
      Record<string, Record<string, Record<string, string>>>
    >;
    doc.translations!.en!.footer!.tagline = 'Hand written';
    writeFileSync(file, stringify(doc));

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await processSection(section(file), 'key', cache)).toBe('skipped');
    expect(sentPayloads()).toEqual([]);
    expect(translationsOf(file).en!.footer).toEqual({
      tagline: 'Hand written',
    });
  });

  it('drops cache entries for Russian that no longer exists', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    const { processSection } = translator();
    const cache: CacheFile = {};
    await processSection(section(file), 'key', cache);
    expect(Object.keys(cache[file] as object)).toHaveLength(6);

    writeFileSync(
      file,
      stringify({
        ...parseDocument(readFileSync(file, 'utf-8')).toJS(),
        footer: { tagline: 'Слоган' },
        nav: { home: 'Главная', cases: 'Кейсы' },
      }),
    );
    const narrower: Section = {
      ...section(file),
      fields: ['nav'],
      schema: navSchema.pick({ nav: true }).strict(),
    };
    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    await processSection(narrower, 'key', cache);
    expect(Object.keys(cache[file] as object)).toHaveLength(4);
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
    const file = writeSection('home.yaml');
    const { processSection } = translator();
    const cache: CacheFile = {};

    await expect(processSection(section(file), 'key', cache)).rejects.toThrow(
      'mixes Latin and Cyrillic',
    );
    expect(Object.values(cache[file] ?? {})).toContain('en');
  });

  it('rejects a response the leaf guard passes but the schema does not', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    const { processSection } = translator();
    const strict: Section = {
      ...section(file),
      schema: z
        .object({
          nav: z
            .object({ home: z.string(), cases: z.string().max(6) })
            .strict(),
          footer: z.object({ tagline: z.string() }).strict(),
        })
        .strict(),
    };
    await expect(processSection(strict, 'key', {})).rejects.toThrow(
      "doesn't match the schema",
    );
  });

  it('lets the committed file win over a cache entry that disagrees', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    const { processSection } = translator();
    const cache: CacheFile = {};
    await processSection(section(file), 'key', cache);

    const block = cache[file] as Record<string, string>;
    const key = Object.keys(block)[0] as string;
    block[key] = '<script>alert(1)</script>';

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await processSection(section(file), 'key', cache)).toBe('skipped');
    expect(JSON.stringify(translationsOf(file))).not.toContain('<script>');
    expect(Object.values(cache[file] as Record<string, string>)).not.toContain(
      '<script>alert(1)</script>',
    );
  });

  it('discards a cache entry that would not have passed as a fresh one', async () => {
    stubTranslate((text) => `t:${text}`);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const file = writeSection('home.yaml');
    const { processSection } = translator();
    const cache: CacheFile = {};
    await processSection(section(file), 'key', cache);

    const written = parseDocument(readFileSync(file, 'utf-8')).toJS() as Record<
      string,
      unknown
    >;
    delete written.translations;
    writeFileSync(file, stringify(written));

    const block = cache[file] as Record<string, string>;
    const key = Object.keys(block)[0] as string;
    block[key] = '<script>alert(1)</script>';

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await processSection(section(file), 'key', cache)).toBe(
      'translated',
    );
    expect(JSON.stringify(translationsOf(file))).not.toContain('<script>');
    expect(Object.values(cache[file] as Record<string, string>)).not.toContain(
      '<script>alert(1)</script>',
    );
    warn.mockRestore();
  });

  it('throws on a malformed ru source before paying for a translation', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml', { nav: { home: 'Главная' } });
    const { processSection } = translator();
    await expect(processSection(section(file), 'key', {})).rejects.toThrow(
      /footer/,
    );
    expect(sentPayloads()).toEqual([]);
  });

  it('regenerates a file whose cache block predates the prompt change', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    const cache: CacheFile = {};
    await translator().processSection(section(file), 'key', cache);

    vi.unstubAllGlobals();
    stubTranslate((text) => `v2:${text}`);
    expect(
      await translator(cachePath, 'a different business').processSection(
        section(file),
        'key',
        cache,
      ),
    ).toBe('translated');
    expect(translationsOf(file).en!.footer).toEqual({ tagline: 'v2:Слоган' });
  });

  it('serves a committed translation written as a YAML alias', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    const cache: CacheFile = {};
    await translator().processSection(section(file), 'key', cache);
    const withAlias = readFileSync(file, 'utf-8').replace(
      /^ {2}en:$/m,
      '  en: &shared',
    );
    writeFileSync(
      file,
      withAlias.replace(/^ {2}sr:\n(?: {4}.*\n?)*/m, '  sr: *shared\n'),
    );

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await translator().processSection(section(file), 'key', cache)).toBe(
      'skipped',
    );
    expect(sentPayloads()).toEqual([]);
  });

  it('writes a hash the runtime side reads back as current', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    await translator().processSection(section(file), 'key', {});
    expect(translationIsCurrent(readFileSync(file, 'utf-8'), navSchema)).toBe(
      true,
    );
  });

  it('is indifferent to the order of keys nested inside a field', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    const cache: CacheFile = {};
    await translator().processSection(section(file), 'key', cache);
    const written = parseDocument(readFileSync(file, 'utf-8')).toJS() as Record<
      string,
      Record<string, unknown>
    >;
    writeFileSync(
      file,
      stringify({
        ...written,
        nav: { cases: written.nav.cases, home: written.nav.home },
      }),
    );

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await translator().processSection(section(file), 'key', cache)).toBe(
      'skipped',
    );
    expect(sentPayloads()).toEqual([]);
  });

  it('retranslates a file whose translations have no hash to vouch for them', async () => {
    stubTranslate((text) => `t:${text}`);
    const translated = {
      nav: { home: 'Home', cases: 'Cases' },
      footer: { tagline: 'Tagline' },
    };
    const file = writeSection('home.yaml', RU_NAV, {
      translations: { en: translated, sr: translated },
    });
    const { processSection } = translator();
    expect(await processSection(section(file), 'key', {})).toBe('translated');
    expect(translationsOf(file).en!.footer).toEqual({ tagline: 't:Слоган' });
  });

  it('restores a wiped translations block from the cache, asking for nothing', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    const { processSection } = translator();
    const cache: CacheFile = {};
    await processSection(section(file), 'key', cache);

    const written = parseDocument(readFileSync(file, 'utf-8')).toJS() as Record<
      string,
      unknown
    >;
    delete written.translations;
    writeFileSync(file, stringify(written));

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await processSection(section(file), 'key', cache)).toBe(
      'backfilled',
    );
    expect(sentPayloads()).toEqual([]);
    expect(translationsOf(file).en!.footer).toEqual({ tagline: 't:Слоган' });
  });

  it('is indifferent to the order the ru keys are written in', async () => {
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    const { processSection } = translator();
    const cache: CacheFile = {};
    await processSection(section(file), 'key', cache);
    const hash = (
      parseDocument(readFileSync(file, 'utf-8')).toJS() as Record<
        string,
        unknown
      >
    ).translatedFrom;

    const written = parseDocument(readFileSync(file, 'utf-8')).toJS() as Record<
      string,
      unknown
    >;
    writeFileSync(
      file,
      stringify({
        footer: written.footer,
        nav: written.nav,
        translations: written.translations,
        translatedFrom: written.translatedFrom,
      }),
    );

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await processSection(section(file), 'key', cache)).toBe('skipped');
    expect(sentPayloads()).toEqual([]);
    expect(
      (
        parseDocument(readFileSync(file, 'utf-8')).toJS() as Record<
          string,
          unknown
        >
      ).translatedFrom,
    ).toBe(hash);
  });
});

describe('run', () => {
  const OLD_KEY = process.env.OPENAI_API_KEY;
  afterEach(() => {
    process.env.OPENAI_API_KEY = OLD_KEY;
    vi.restoreAllMocks();
  });

  it('refuses to start without an api key', async () => {
    delete process.env.OPENAI_API_KEY;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await translator().run([])).toBe(1);
    expect(error).toHaveBeenCalledWith('Missing env var: OPENAI_API_KEY');
  });

  it('writes the cache file and reuses it next time', async () => {
    process.env.OPENAI_API_KEY = 'key';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');

    expect(await translator().run([section(file)])).toBe(0);
    expect(Object.keys(loadCache(cachePath))).toEqual([file]);

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await translator().run([section(file)])).toBe(0);
    expect(sentPayloads()).toEqual([]);
  });

  it('reports the run that restored a block without translating', async () => {
    process.env.OPENAI_API_KEY = 'key';
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    await translator().run([section(file)]);

    const written = parseDocument(readFileSync(file, 'utf-8')).toJS() as Record<
      string,
      unknown
    >;
    delete written.translations;
    writeFileSync(file, stringify(written));

    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    expect(await translator().run([section(file)])).toBe(0);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('no translation needed'),
    );
  });

  it('reports a failure and keeps going', async () => {
    process.env.OPENAI_API_KEY = 'key';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(openAiErrorResponse('boom')),
    );
    const file = writeSection('home.yaml');
    expect(await translator().run([section(file)])).toBe(1);
    expect(error).toHaveBeenCalled();
  });

  it('keeps the entries of an earlier file when a later one fails', async () => {
    process.env.OPENAI_API_KEY = 'key';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const good = writeSection('a-good.yaml');
    const bad = writeSection('z-bad.yaml');
    let call = 0;
    stubOpenAiFetch((content) => {
      call += 1;
      const payload = JSON.parse(content) as Record<string, string>;
      if (call > 2) return {};
      return Object.fromEntries(
        Object.entries(payload).map(([path, text]) => [path, `t:${text}`]),
      );
    });

    expect(await translator().run([section(good), section(bad)])).toBe(1);
    expect(Object.keys(loadCache(cachePath))).toContain(good);
  });

  it('refuses to start on a cache it cannot read, without crashing', async () => {
    process.env.OPENAI_API_KEY = 'key';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    writeFileSync(cachePath, '{not json');
    expect(await translator().run([])).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining(cachePath));
  });

  it('forgets a file that no longer exists, but only on a clean run', async () => {
    process.env.OPENAI_API_KEY = 'key';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    await translator().run([section(file)]);

    rmSync(file);
    const second = writeSection('other.yaml');
    vi.unstubAllGlobals();
    stubTranslate((text) => `t:${text}`);
    await translator().run([section(second)]);

    expect(Object.keys(loadCache(cachePath))).toEqual([second]);
  });

  it('leaves a vanished file untouched in the cache when the run had a failure', async () => {
    process.env.OPENAI_API_KEY = 'key';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubTranslate((text) => `t:${text}`);
    const file = writeSection('home.yaml');
    await translator().run([section(file)]);

    rmSync(file);
    const second = writeSection('other.yaml');
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(openAiErrorResponse('boom')),
    );
    await translator().run([section(second)]);

    expect(Object.keys(loadCache(cachePath))).toContain(file);
  });
});
