import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDocument, stringify } from 'yaml';
import type { DictionaryContent } from '../src/i18n/dictionaryContentSchema.ts';
import { dictionaryContentSchema } from '../src/i18n/dictionaryContentSchema.ts';
import { faqContentSchema } from '../src/i18n/content/faqContentSchema.ts';
import type { Section } from './translate-i18n';
import { hashSource, translateSection, processSection } from './translate-i18n';
import {
  stubOpenAiResponse,
  stubOpenAiFetch,
  openAiErrorResponse,
} from './lib/mockOpenAiFetch';

// A minimal but *complete* dictionary fixture — every field the strict
// schema requires.
const RU_DICTIONARY: DictionaryContent = {
  nav: {
    'vehicle-sourcing': 'Автоподбор',
    'vehicle-import': 'Авто из ЕС и Китая',
    'auto-service-belgrade': 'Автосервис',
    'detailing-belgrade': 'Детейлинг',
    'vehicle-buyback': 'Выкуп',
    'vehicle-inspection': 'Проверка',
    cases: 'Кейсы',
    contacts: 'Контакты',
    moreServices: 'Ещё услуги',
  },
  header: {
    menuLabel: 'Меню',
    languageLabel: 'Язык',
    themeToggleLabel: 'Переключить тему',
    themeToggleMobileLabel: 'Сменить тему',
    ctaShort: 'Заявка',
    ctaLong: 'Оставить заявку',
  },
  footer: {
    servicesHeading: 'Услуги',
    companyHeading: 'Компания',
    privacyLabel: 'Конфиденциальность',
    tagline: 'Слоган',
    contactManagerLabel: 'Написать менеджеру',
    hoursLine: 'Круглосуточно',
    copyrightSuffix: 'Копирайт',
    channelLinkLabel: 'Наш канал',
  },
  common: {
    otherServicesLabel: 'Другие услуги:',
    alsoWorkingInLabel: 'Также работаем в:',
    homeLabel: 'Главная',
    faqHeading: 'Частые вопросы',
    whereFromLabel: 'Откуда вы?',
    otherCountryLabel: 'Другая страна',
    viewAllCasesLabel: 'Все кейсы',
    closeLabel: 'Закрыть',
    channelLabel: 'Наш канал',
    cookie: {
      notice: 'Уведомление',
      more: 'Подробнее',
      policyLink: 'политике',
      accept: 'Принять',
      decline: 'Отклонить',
    },
    gallery: {
      morePhotos: 'Больше фото',
      prev: 'Предыдущее',
      next: 'Следующее',
    },
  },
};

const DICTIONARY_SECTION: Section = {
  path: '',
  fields: ['nav', 'header', 'footer', 'common'],
  schema: dictionaryContentSchema,
  promptSubject: 'UI copy',
};

// Small (deliberately not the real, much bigger) FAQ fixture — just enough
// to exercise the array-of-objects shape faq.yaml actually uses.
const RU_FAQ = {
  'vehicle-sourcing': [{ q: 'Сколько это стоит?', a: 'По запросу.' }],
  'vehicle-import': [{ q: 'А привоз?', a: 'Тоже возможно.' }],
  'vehicle-buyback': [{ q: 'Выкупаете?', a: 'Да.' }],
  'vehicle-inspection': [{ q: 'Проверяете?', a: 'Да.' }],
  autoServiceBelgrade: [{ q: 'Есть сервис?', a: 'Да.' }],
  detailingBelgrade: [{ q: 'Детейлинг есть?', a: 'Да.' }],
  general: [{ q: 'Как оплатить?', a: 'Наличными.' }],
  cityExpert: { q: 'Эксперт в городе?', a: 'Да.' },
};

const FAQ_SECTION: Section = {
  path: '',
  fields: [
    'vehicle-sourcing',
    'vehicle-import',
    'vehicle-buyback',
    'vehicle-inspection',
    'autoServiceBelgrade',
    'detailingBelgrade',
    'general',
    'cityExpert',
  ],
  schema: faqContentSchema,
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
    const a = { nav: { home: 'Главная' } };
    const b = { nav: { home: 'Главная' } };
    expect(hashSource(a)).toBe(hashSource(b));
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

// decideAction now lives in scripts/lib/translateDecision.ts,
// hasRealTranslation in scripts/lib/hasRealTranslation.ts, and
// assertSafeTranslation in scripts/lib/assertSafeTranslation.ts — all three
// shared with translate-cases.ts, see their own test files for coverage.
// The one HTML-guard test below stays as a wiring check that
// translateSection actually calls assertSafeTranslation with the right
// arguments, not a re-test of the guard's own logic.

describe('translateSection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockResponse = stubOpenAiResponse;

  it('translates a dictionary-shaped section and validates the response', async () => {
    const translated = upper(RU_DICTIONARY);
    mockResponse(translated);
    const result = await translateSection(
      RU_DICTIONARY,
      'en',
      'test-key',
      DICTIONARY_SECTION,
    );
    expect(result).toEqual(translated);
  });

  it('translates a FAQ-shaped section (arrays of objects) and validates the response', async () => {
    const translated = upper(RU_FAQ);
    mockResponse(translated);
    const result = await translateSection(
      RU_FAQ,
      'en',
      'test-key',
      FAQ_SECTION,
    );
    expect(result).toEqual(translated);
  });

  it('throws when the response has a leaf of the wrong type', async () => {
    const translated = { ...upper(RU_DICTIONARY) };
    // @ts-expect-error -- deliberately breaking the shape for this test
    translated.nav.cases = 42;
    mockResponse(translated);
    await expect(
      translateSection(RU_DICTIONARY, 'en', 'test-key', DICTIONARY_SECTION),
    ).rejects.toThrow();
  });

  it('throws when a translated string contains raw HTML (a stored-XSS guard for the unreviewed auto-commit path)', async () => {
    const translated = {
      ...upper(RU_DICTIONARY),
      common: {
        ...upper(RU_DICTIONARY).common,
        homeLabel: '<script>alert(1)</script>',
      },
    };
    mockResponse(translated);
    await expect(
      translateSection(RU_DICTIONARY, 'en', 'test-key', DICTIONARY_SECTION),
    ).rejects.toThrow(/homeLabel/);
  });

  it('throws when the OpenAI call itself fails', async () => {
    // maxRetries defaults to 2 — a 500 is retried (real backoff delays), so
    // every call must fail the same way for this to surface at all.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => openAiErrorResponse('boom', 500)),
    );
    await expect(
      translateSection(RU_DICTIONARY, 'en', 'test-key', DICTIONARY_SECTION),
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
  });

  function stubTranslateFetch() {
    stubOpenAiFetch((userContent) => upper(JSON.parse(userContent)));
  }

  it('translates a dictionary-shaped section on first run and writes the hash back', async () => {
    stubTranslateFetch();
    writeFileSync(file, stringify({ ...RU_DICTIONARY, translations: {} }));

    const result = await processSection(
      { ...DICTIONARY_SECTION, path: file },
      'test-key',
    );
    expect(result).toBe('translated');

    const doc = parseDocument(readFileSync(file, 'utf-8'));
    expect(doc.getIn(['translations', 'en', 'nav', 'cases'])).toBe('КЕЙСЫ');
    expect(typeof doc.get('translatedFrom')).toBe('string');
    expect(doc.getIn(['nav', 'cases'])).toBe('Кейсы');
  });

  it('skips on a second run with no ru changes', async () => {
    stubTranslateFetch();
    writeFileSync(file, stringify({ ...RU_DICTIONARY, translations: {} }));
    const section = { ...DICTIONARY_SECTION, path: file };

    await processSection(section, 'test-key');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await processSection(section, 'test-key');
    expect(result).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('translates a FAQ-shaped section (array of objects) end to end', async () => {
    stubTranslateFetch();
    writeFileSync(file, stringify({ ...RU_FAQ, translations: {} }));

    const result = await processSection(
      { ...FAQ_SECTION, path: file },
      'test-key',
    );
    expect(result).toBe('translated');

    const doc = parseDocument(readFileSync(file, 'utf-8'));
    expect(doc.getIn(['translations', 'en', 'vehicle-sourcing', 0, 'q'])).toBe(
      'СКОЛЬКО ЭТО СТОИТ?',
    );
    expect(doc.getIn(['translations', 'en', 'cityExpert', 'q'])).toBe(
      'ЭКСПЕРТ В ГОРОДЕ?',
    );
  });

  it('throws instead of writing when ru itself fails schema validation', async () => {
    writeFileSync(file, 'nav:\n  home: Главная\ntranslations: {}\n');
    await expect(
      processSection({ ...DICTIONARY_SECTION, path: file }, 'test-key'),
    ).rejects.toThrow();
  });
});
