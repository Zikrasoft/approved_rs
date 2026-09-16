import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  assemble,
  chunkLeaves,
  collectLeaves,
  leavesToPayload,
  translateLeaves,
  type Leaf,
} from './translateLeaves.ts';
import { DEFAULT_TRANSLATE_MODEL } from './openaiChat.ts';
import {
  sentPayloads,
  stubOpenAiFetch,
  stubOpenAiResponse,
  stubTranslate,
} from './mockOpenAiFetch.ts';

const SECTION = {
  nav: { services: 'Услуги', works: 'Работы' },
  steps: [
    { title: 'Первый', hints: ['раз', 'два'] },
    { title: 'Второй', hints: [] },
  ],
  rows: [{ panel: 'Капот', value: 120, thin: false }],
  blank: '',
  nothing: null,
};

const mapOf = (leaves: readonly Leaf[]) =>
  new Map(leaves.map((leaf) => [leaf.path, leaf.text]));

describe('collectLeaves', () => {
  it('walks objects and arrays in source order', () => {
    expect(collectLeaves(SECTION).map((leaf) => leaf.path)).toEqual([
      'nav.services',
      'nav.works',
      'steps[0].title',
      'steps[0].hints[0]',
      'steps[0].hints[1]',
      'steps[1].title',
      'rows[0].panel',
      'blank',
    ]);
  });

  it('carries the text alongside the path', () => {
    expect(collectLeaves({ a: 'один' })).toEqual([
      { path: 'a', text: 'один', committed: undefined },
    ]);
  });

  it('skips numbers, booleans and null — they are copied, never translated', () => {
    expect(collectLeaves({ n: 1, b: true, z: null })).toEqual([]);
  });

  it('treats a bare string as the whole source', () => {
    expect(collectLeaves('Заявка')).toEqual([
      { path: '', text: 'Заявка', committed: undefined },
    ]);
  });

  it.each([
    ['a dot in a key', { 'a.b': 'первый', a: { b: 'второй' } }],
    ['a bracket in a key', { 'a[0]': { b: 'литерал' }, a: [{ b: 'массив' }] }],
    ['a backslash in a key', { 'a\\': { b: 'слэш' }, 'a.b': 'точка' }],
  ])('keeps two leaves apart when a key contains %s', (_label, source) => {
    const leaves = collectLeaves(source);
    expect(new Set(leaves.map((leaf) => leaf.path)).size).toBe(leaves.length);
    expect(
      assemble(source, new Map(leaves.map((leaf) => [leaf.path, leaf.text]))),
    ).toEqual(source);
  });

  it('does not let a literal bracket in a key collide with an array index', () => {
    const leaves = collectLeaves({
      'a[0]': { b: 'ЛИТЕРАЛ' },
      a: [{ b: 'МАССИВ' }],
    });
    expect(new Set(leaves.map((leaf) => leaf.path)).size).toBe(2);
    expect(
      assemble(
        { 'a[0]': { b: 'ЛИТЕРАЛ' }, a: [{ b: 'МАССИВ' }] },
        new Map(leaves.map((leaf) => [leaf.path, leaf.text.toUpperCase()])),
      ),
    ).toEqual({ 'a[0]': { b: 'ЛИТЕРАЛ' }, a: [{ b: 'МАССИВ' }] });
  });

  it('does not read a string as a translated map of numeric keys', () => {
    expect(collectLeaves({ 0: 'Первый' }, 'строка')).toEqual([
      { path: '0', text: 'Первый', committed: undefined },
    ]);
  });

  it('finds nothing in an empty object or array', () => {
    expect(collectLeaves({})).toEqual([]);
    expect(collectLeaves([])).toEqual([]);
  });

  it('picks up what the file already holds at the same path', () => {
    const leaves = collectLeaves(SECTION, {
      nav: { services: 'Usluge' },
      steps: [{ hints: ['jedan', 'dva'] }, { title: 'Drugi' }],
    });
    const committed = Object.fromEntries(
      leaves.map((leaf) => [leaf.path, leaf.committed]),
    );
    expect(committed['nav.services']).toBe('Usluge');
    expect(committed['steps[0].hints[0]']).toBe('jedan');
    expect(committed['nav.works']).toBeUndefined();
  });

  it.each([
    ['a non-object where an object is expected', 'строка'],
    ['an object where an array is expected', { steps: {} }],
    ['a non-string leaf', { blank: 7 }],
    ['nothing at all', undefined],
  ])('leaves the committed value undefined for %s', (_label, existing) => {
    const leaves = collectLeaves(SECTION, existing);
    expect(leaves.every((leaf) => leaf.committed === undefined)).toBe(true);
  });

  it.each([
    ['one item short', ['jedan']],
    ['one item long', ['jedan', 'dva', 'tri']],
  ])('pairs nothing when the committed list is %s', (_label, list) => {
    const leaves = collectLeaves({ list: ['раз', 'два'] }, { list });
    expect(leaves.map((leaf) => leaf.committed)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('pairs by position while the two lists match in length', () => {
    const leaves = collectLeaves(
      { list: ['раз', 'два'] },
      { list: ['jedan', 'dva'] },
    );
    expect(leaves.map((leaf) => leaf.committed)).toEqual(['jedan', 'dva']);
  });
});

describe('assemble', () => {
  it('round-trips the source when every leaf maps to itself', () => {
    expect(assemble(SECTION, mapOf(collectLeaves(SECTION)))).toEqual(SECTION);
  });

  it('substitutes only the paths it was given', () => {
    const result = assemble(
      SECTION,
      new Map([['nav.services', 'Usluge']]),
    ) as typeof SECTION;
    expect(result.nav.services).toBe('Usluge');
    expect(result.nav.works).toBe('Работы');
  });

  it('keeps non-string values identical', () => {
    const result = assemble(SECTION, new Map()) as typeof SECTION;
    expect(result.rows[0]?.value).toBe(120);
    expect(result.rows[0]?.thin).toBe(false);
    expect(result.nothing).toBeNull();
  });

  it('preserves array shape, including an empty one', () => {
    const result = assemble(SECTION, new Map()) as typeof SECTION;
    expect(result.steps[1]?.hints).toEqual([]);
    expect(result.steps).toHaveLength(2);
  });

  it('substitutes a bare string source', () => {
    expect(assemble('Заявка', new Map([['', 'Prijava']]))).toBe('Prijava');
  });
});

describe('chunkLeaves', () => {
  const leaf = (path: string, text: string): Leaf => ({
    path,
    text,
    committed: undefined,
  });

  it('packs as many leaves as the budget allows', () => {
    const leaves = [leaf('a', 'x'), leaf('b', 'y'), leaf('c', 'z')];
    const chunks = chunkLeaves(leaves, 20);
    expect(chunks.flat()).toEqual(leaves);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('keeps everything in one chunk when the budget is generous', () => {
    const leaves = [leaf('a', 'x'), leaf('b', 'y')];
    expect(chunkLeaves(leaves, 10_000)).toEqual([leaves]);
  });

  it('sends a leaf bigger than the budget on its own rather than splitting it', () => {
    const big = leaf('body', 'э'.repeat(500));
    const chunks = chunkLeaves([leaf('a', 'x'), big, leaf('b', 'y')], 40);
    expect(chunks.some((chunk) => chunk.length === 1 && chunk[0] === big)).toBe(
      true,
    );
    expect(chunks.flat()).toHaveLength(3);
  });

  it('emits no empty chunk when the oversized leaf comes first', () => {
    const big = leaf('body', 'э'.repeat(500));
    const chunks = chunkLeaves([big, leaf('a', 'x')], 40);
    expect(chunks.every((chunk) => chunk.length > 0)).toBe(true);
    expect(chunks.flat()).toHaveLength(2);
  });

  it('fills a chunk exactly to the budget before starting the next', () => {
    const one = JSON.stringify({ a: 'x' }).length;
    const leaves = [leaf('a', 'x'), leaf('b', 'y')];
    expect(chunkLeaves(leaves, one * 2)).toEqual([leaves]);
    expect(chunkLeaves(leaves, one * 2 - 1)).toHaveLength(2);
  });

  it('returns nothing for nothing', () => {
    expect(chunkLeaves([], 100)).toEqual([]);
  });
});

describe('leavesToPayload', () => {
  it('flattens leaves into the object the model is sent', () => {
    expect(
      leavesToPayload(collectLeaves({ nav: { services: 'Услуги' } })),
    ).toEqual({ 'nav.services': 'Услуги' });
  });

  it('keeps the key shape that tells the model what a string is for', () => {
    const payload = leavesToPayload(collectLeaves(SECTION));
    expect(Object.keys(payload)).toContain('steps[0].hints[1]');
  });
});

describe('translateLeaves', () => {
  const PROMPT = 'You translate UI copy from Russian into Serbian.';
  const SOURCE = { nav: { services: 'Услуги' }, lead: 'Оставьте заявку' };
  const base = {
    systemPrompt: PROMPT,
    apiKey: 'k',
    model: 'gpt-4o-mini',
    neverTranslated: false,
  };

  afterEach(() => vi.unstubAllGlobals());

  it('translates every leaf on a cold cache', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    const result = await translateLeaves({
      ...base,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    expect(result.value).toEqual({
      nav: { services: 'УСЛУГИ' },
      lead: 'ОСТАВЬТЕ ЗАЯВКУ',
    });
    expect(result.requests).toBe(1);
    expect(Object.keys(block)).toHaveLength(2);
  });

  it('makes no request at all on the second run', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    await translateLeaves({
      ...base,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    const second = await translateLeaves({
      ...base,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    expect(second.requests).toBe(0);
    expect(second.value).toEqual({
      nav: { services: 'УСЛУГИ' },
      lead: 'ОСТАВЬТЕ ЗАЯВКУ',
    });
  });

  it('sends exactly the one leaf that changed, and nothing else', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    await translateLeaves({
      ...base,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    vi.unstubAllGlobals();
    stubTranslate((text) => text.toUpperCase());
    const result = await translateLeaves({
      ...base,
      source: { ...SOURCE, lead: 'Оставьте заявку сегодня' },
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    expect(result.requests).toBe(1);
    expect(sentPayloads()).toEqual([{ lead: 'Оставьте заявку сегодня' }]);
  });

  it('costs nothing when an array is merely reordered', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    await translateLeaves({
      ...base,
      source: { list: ['раз', 'два'] },
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    vi.unstubAllGlobals();
    stubTranslate((text) => text.toUpperCase());
    const result = await translateLeaves({
      ...base,
      source: { list: ['два', 'раз'] },
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    expect(result.requests).toBe(0);
    expect(result.value).toEqual({ list: ['ДВА', 'РАЗ'] });
  });

  it('regenerates everything when the prompt changes', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    await translateLeaves({
      ...base,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    vi.unstubAllGlobals();
    stubTranslate((text) => text.toUpperCase());
    const result = await translateLeaves({
      ...base,
      systemPrompt: `${PROMPT} Keep it short.`,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    expect(result.requests).toBe(1);
    expect(sentPayloads()[0]).toEqual({
      'nav.services': 'Услуги',
      lead: 'Оставьте заявку',
    });
  });

  it('regenerates everything when the model changes', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    await translateLeaves({
      ...base,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    vi.unstubAllGlobals();
    stubTranslate((text) => text.toUpperCase());
    const result = await translateLeaves({
      ...base,
      model: 'gpt-5',
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    expect(result.requests).toBe(1);
  });

  it('hashes the resolved model, so the default is not a blind spot', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    await translateLeaves({
      ...base,
      model: undefined,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    vi.unstubAllGlobals();
    stubTranslate((text) => text.toUpperCase());
    const result = await translateLeaves({
      ...base,
      model: DEFAULT_TRANSLATE_MODEL,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    expect(result.requests).toBe(0);
  });

  it('adopts what is already in the file on first sight of it', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    const result = await translateLeaves({
      ...base,
      source: SOURCE,
      existing: { nav: { services: 'Usluge' }, lead: 'Ostavite zahtev' },
      neverTranslated: true,
      block,
      translationsAreCurrent: true,
    });
    expect(result.requests).toBe(0);
    expect(result.value).toEqual({
      nav: { services: 'Usluge' },
      lead: 'Ostavite zahtev',
    });
    expect(Object.values(block)).toEqual(
      expect.arrayContaining(['Usluge', 'Ostavite zahtev']),
    );
  });

  it('keeps a hand-written value and stops asking for it', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    await translateLeaves({
      ...base,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    const handEdited = { nav: { services: 'Usluge' }, lead: 'ОСТАВЬТЕ ЗАЯВКУ' };
    vi.unstubAllGlobals();
    stubTranslate((text) => text.toUpperCase());
    const adopted = await translateLeaves({
      ...base,
      source: SOURCE,
      existing: handEdited,
      block,
      translationsAreCurrent: true,
    });
    expect(adopted.requests).toBe(0);
    expect((adopted.value as typeof handEdited).nav.services).toBe('Usluge');

    const again = await translateLeaves({
      ...base,
      source: SOURCE,
      existing: handEdited,
      block,
      translationsAreCurrent: true,
    });
    expect(again.requests).toBe(0);
    expect((again.value as typeof handEdited).nav.services).toBe('Usluge');
  });

  it('does not adopt a stale value once its Russian has changed', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    const result = await translateLeaves({
      ...base,
      source: { lead: 'Новый текст' },
      existing: { lead: 'Перевод старого текста' },
      block,
      translationsAreCurrent: false,
    });
    expect(result.requests).toBe(1);
    expect(result.value).toEqual({ lead: 'НОВЫЙ ТЕКСТ' });
  });

  it('refuses a hand-edit that drops a placeholder, rather than wedging on it', async () => {
    stubOpenAiFetch((content) =>
      Object.fromEntries(
        Object.entries(JSON.parse(content) as Record<string, string>).map(
          ([path, text]) => [path, `sr ${text}`],
        ),
      ),
    );
    const block = {};
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await translateLeaves({
      ...base,
      source: { title: 'Подбор в {location}' },
      existing: { title: 'Odabir vozila' },
      neverTranslated: true,
      block,
      translationsAreCurrent: true,
    });
    expect(result.requests).toBe(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('ignoring hand-written title'),
    );
    warn.mockRestore();
  });

  it('does not reattach a translation to the wrong item when a list is reordered', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    await translateLeaves({
      ...base,
      source: { steps: ['Осмотр', 'Оценка'] },
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });

    vi.unstubAllGlobals();
    stubTranslate((text) => text.toUpperCase());
    const result = await translateLeaves({
      ...base,
      source: { steps: ['Оценка', 'Осмотр'] },
      existing: { steps: ['ОСМОТР', 'ОЦЕНКА'] },
      block,
      translationsAreCurrent: false,
    });
    expect(result.requests).toBe(0);
    expect(result.value).toEqual({ steps: ['ОЦЕНКА', 'ОСМОТР'] });
  });

  it('does not reattach translations by position when somebody edits the list', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    const result = await translateLeaves({
      ...base,
      source: { steps: ['Осмотр', 'Оценка', 'Выдача'] },
      existing: { steps: ['OCENA', 'IZDAVANJE'] },
      neverTranslated: true,
      block,
      translationsAreCurrent: true,
    });
    expect(result.value).toEqual({ steps: ['ОСМОТР', 'ОЦЕНКА', 'ВЫДАЧА'] });
    expect(Object.values(block)).not.toContain('OCENA');
  });

  it('treats a cache entry that would fail as fresh output as a miss', async () => {
    stubTranslate((text) => text.toUpperCase());
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const block = {};
    await translateLeaves({
      ...base,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });

    const poisoned = Object.keys(block)[0] as string;
    (block as Record<string, string>)[poisoned] = '<script>alert(1)</script>';

    vi.unstubAllGlobals();
    stubTranslate((text) => text.toUpperCase());
    const result = await translateLeaves({
      ...base,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    expect(result.requests).toBe(1);
    expect(JSON.stringify(result.value)).not.toContain('<script>');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('discarding'));
    warn.mockRestore();
  });

  it('refuses to adopt a translation somebody blanked out', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    const result = await translateLeaves({
      ...base,
      source: { lead: 'Оставьте заявку' },
      existing: { lead: '   ' },
      neverTranslated: true,
      block,
      translationsAreCurrent: true,
    });
    expect(result.requests).toBe(1);
    expect(result.value).toEqual({ lead: 'ОСТАВЬТЕ ЗАЯВКУ' });
    expect(Object.values(block)).not.toContain('   ');
  });

  it('never sends a blank string, and keeps it blank', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    const result = await translateLeaves({
      ...base,
      source: { filled: 'Текст', blank: '   ' },
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    expect(sentPayloads()).toEqual([{ filled: 'Текст' }]);
    expect(result.value).toEqual({ filled: 'ТЕКСТ', blank: '   ' });
  });

  it('reports every key it used, so the caller can prune the rest', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = { stale: 'старое' };
    const result = await translateLeaves({
      ...base,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    expect(result.used.size).toBe(2);
    expect(result.used.has('stale')).toBe(false);
  });

  it('splits a section too large for one request', async () => {
    stubTranslate((text) => text.toUpperCase());
    const long = 'э'.repeat(5_000);
    const result = await translateLeaves({
      ...base,
      source: { a: `${long}а`, b: `${long}б` },
      existing: undefined,
      block: {},
      translationsAreCurrent: true,
    });
    expect(result.requests).toBe(2);
    expect(sentPayloads()).toHaveLength(2);
  });

  it('retries a garbled chunk before giving up', async () => {
    let call = 0;
    stubOpenAiFetch((content) => {
      call += 1;
      const payload = JSON.parse(content) as Record<string, string>;
      if (call === 1) return { 'nav.services': 'Uslугi', lead: 'x' };
      return Object.fromEntries(
        Object.keys(payload).map((path) => [path, 'ok']),
      );
    });
    const result = await translateLeaves({
      ...base,
      source: SOURCE,
      existing: undefined,
      block: {},
      translationsAreCurrent: true,
    });
    expect(result.requests).toBe(2);
    expect(result.value).toEqual({ nav: { services: 'ok' }, lead: 'ok' });
  });

  it('keeps trying to the third attempt rather than giving up on the second', async () => {
    let call = 0;
    stubOpenAiFetch((content) => {
      call += 1;
      const payload = JSON.parse(content) as Record<string, string>;
      if (call < 3) return { 'nav.services': 'Uslугi', lead: 'x' };
      return Object.fromEntries(
        Object.keys(payload).map((path) => [path, 'ok']),
      );
    });
    const result = await translateLeaves({
      ...base,
      source: SOURCE,
      existing: undefined,
      block: {},
      translationsAreCurrent: true,
    });
    expect(result.requests).toBe(3);
    expect(result.value).toEqual({ nav: { services: 'ok' }, lead: 'ok' });
  });

  it('gives up loudly after three garbled attempts, caching nothing', async () => {
    stubOpenAiResponse({ 'nav.services': 'Uslугi', lead: 'x' });
    const block = {};
    await expect(
      translateLeaves({
        ...base,
        source: SOURCE,
        existing: undefined,
        block,
        translationsAreCurrent: true,
      }),
    ).rejects.toThrow('mixes Latin and Cyrillic');
    expect(block).toEqual({});
  });
  it('regenerates instead of adopting when only the prompt changed', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    const first = await translateLeaves({
      ...base,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });

    vi.unstubAllGlobals();
    stubTranslate((text) => `sr ${text}`);
    const result = await translateLeaves({
      ...base,
      systemPrompt: `${PROMPT} Never use the polite form.`,
      source: SOURCE,
      existing: first.value,
      block,
      translationsAreCurrent: true,
    });
    expect(result.requests).toBe(1);
    expect(result.value).toEqual({
      nav: { services: 'sr Услуги' },
      lead: 'sr Оставьте заявку',
    });
  });

  it('warns when an unrelated Russian edit costs a hand-written translation', async () => {
    stubTranslate((text) => text.toUpperCase());
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const block = {};
    await translateLeaves({
      ...base,
      source: SOURCE,
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });

    vi.unstubAllGlobals();
    stubTranslate((text) => text.toUpperCase());
    const result = await translateLeaves({
      ...base,
      source: SOURCE,
      existing: { nav: { services: 'Usluge' }, lead: 'ОСТАВЬТЕ ЗАЯВКУ' },
      block,
      translationsAreCurrent: false,
    });
    expect(result.requests).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('overwriting hand-written nav.services'),
    );
    warn.mockRestore();
  });

  it('stays quiet about the string whose own Russian moved', async () => {
    stubTranslate((text) => text.toUpperCase());
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const block = {};
    await translateLeaves({
      ...base,
      source: { moved: 'Старый', kept: 'Общий' },
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });

    vi.unstubAllGlobals();
    stubTranslate((text) => text.toUpperCase());
    await translateLeaves({
      ...base,
      source: { moved: 'Новый', kept: 'Общий' },
      existing: { moved: 'Rucno A', kept: 'Rucno B' },
      block,
      translationsAreCurrent: false,
    });
    expect(
      warn.mock.calls.filter((call) =>
        String(call[0]).includes('overwriting hand-written'),
      ),
    ).toHaveLength(1);
    warn.mockRestore();
  });

  it('asks once for the same Russian written in two places', async () => {
    stubTranslate((text) => text.toUpperCase());
    const block = {};
    const result = await translateLeaves({
      ...base,
      source: { hero: { cta: 'Что входит' }, plans: { cta: 'Что входит' } },
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    expect(sentPayloads()).toEqual([{ 'hero.cta': 'Что входит' }]);
    expect(result.value).toEqual({
      hero: { cta: 'ЧТО ВХОДИТ' },
      plans: { cta: 'ЧТО ВХОДИТ' },
    });
    expect(Object.keys(block)).toHaveLength(1);
  });

  it('validates a cache entry the file already agrees with', async () => {
    stubTranslate((text) => text.toUpperCase());
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const block: Record<string, string> = {};
    await translateLeaves({
      ...base,
      source: { lead: 'Оставьте заявку' },
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    const key = Object.keys(block)[0] as string;
    block[key] = '<script>alert(1)</script>';

    vi.unstubAllGlobals();
    stubTranslate((text) => text.toUpperCase());
    const result = await translateLeaves({
      ...base,
      source: { lead: 'Оставьте заявку' },
      existing: { lead: '<script>alert(1)</script>' },
      block,
      translationsAreCurrent: true,
    });
    expect(result.requests).toBe(1);
    expect(result.value).toEqual({ lead: 'ОСТАВЬТЕ ЗАЯВКУ' });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('discarding cached lead'),
    );
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('ignoring hand-written'),
    );
    warn.mockRestore();
  });

  it('drops a cache entry it could not replace', async () => {
    stubTranslate((text) => text.toUpperCase());
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const block: Record<string, string> = {};
    await translateLeaves({
      ...base,
      source: { lead: 'Оставьте заявку' },
      existing: undefined,
      block,
      translationsAreCurrent: true,
    });
    const key = Object.keys(block)[0] as string;
    block[key] = '<script>alert(1)</script>';

    vi.unstubAllGlobals();
    stubOpenAiResponse({ lead: 'Uslугi' });
    await expect(
      translateLeaves({
        ...base,
        source: { lead: 'Оставьте заявку' },
        existing: undefined,
        block,
        translationsAreCurrent: true,
      }),
    ).rejects.toThrow('mixes Latin and Cyrillic');
    expect(block).toEqual({});
    warn.mockRestore();
  });
});
