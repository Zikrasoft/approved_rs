import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  leafKey,
  loadCache,
  promptFingerprint,
  saveCache,
  type CacheFile,
} from './leafCache.ts';

const PROMPT = 'You translate UI copy from Russian into Serbian.';

describe('promptFingerprint', () => {
  it('ignores how the prompt is wrapped', () => {
    expect(promptFingerprint('one two\n  three', 'gpt-4o-mini')).toBe(
      promptFingerprint('one\ttwo three', 'gpt-4o-mini'),
    );
  });

  it('changes when a word of the prompt changes', () => {
    expect(promptFingerprint(PROMPT, 'gpt-4o-mini')).not.toBe(
      promptFingerprint(`${PROMPT} Keep it short.`, 'gpt-4o-mini'),
    );
  });

  it('changes when the model changes', () => {
    expect(promptFingerprint(PROMPT, 'gpt-4o-mini')).not.toBe(
      promptFingerprint(PROMPT, 'gpt-5'),
    );
  });

  it('does not let the prompt/model boundary shift without changing the key', () => {
    expect(promptFingerprint('ab', 'c')).not.toBe(promptFingerprint('a', 'bc'));
  });

  it('collapses runs of whitespace without deleting the word boundary', () => {
    expect(promptFingerprint('one two', 'm')).not.toBe(
      promptFingerprint('onetwo', 'm'),
    );
  });

  it('ignores whitespace at either end, which a template literal leaves behind', () => {
    expect(promptFingerprint('\n  one two \n', 'm')).toBe(
      promptFingerprint('one two', 'm'),
    );
  });
});

describe('leafKey', () => {
  it('is stable for the same text under the same prompt', () => {
    const fingerprint = promptFingerprint(PROMPT, 'gpt-4o-mini');
    expect(leafKey(fingerprint, 'Заявка')).toBe(leafKey(fingerprint, 'Заявка'));
  });

  it('separates two texts under one prompt', () => {
    const fingerprint = promptFingerprint(PROMPT, 'gpt-4o-mini');
    expect(leafKey(fingerprint, 'Заявка')).not.toBe(
      leafKey(fingerprint, 'Заявки'),
    );
  });

  it('separates one text under two prompts', () => {
    expect(leafKey(promptFingerprint(PROMPT, 'a'), 'Заявка')).not.toBe(
      leafKey(promptFingerprint(PROMPT, 'b'), 'Заявка'),
    );
  });
});

describe('loadCache and saveCache', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'leaf-cache-'));
    path = join(dir, 'translations.cache.json');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('reads back what it wrote', () => {
    const cache: CacheFile = {
      'src/content/i18n/home.yaml': { abc: 'Prijava' },
    };
    saveCache(path, cache);
    expect(loadCache(path)).toEqual(cache);
  });

  it('starts empty when there is no cache yet', () => {
    expect(loadCache(join(dir, 'absent.json'))).toEqual({});
  });

  it('sorts both levels so a new entry is one added line, not a reshuffle', () => {
    saveCache(path, {
      'b.yaml': { zz: 'last', aa: 'first' },
      'a.yaml': { mm: 'only' },
    });
    expect(readFileSync(path, 'utf-8')).toBe(
      `${JSON.stringify(
        { 'a.yaml': { mm: 'only' }, 'b.yaml': { aa: 'first', zz: 'last' } },
        null,
        2,
      )}\n`,
    );
  });

  it('writes a file the next run reads back unchanged', () => {
    const cache: CacheFile = { 'a.yaml': { k: 'v' } };
    saveCache(path, cache);
    const first = readFileSync(path, 'utf-8');
    saveCache(path, loadCache(path));
    expect(readFileSync(path, 'utf-8')).toBe(first);
  });

  it('handles a file with no entries at all', () => {
    saveCache(path, {});
    expect(loadCache(path)).toEqual({});
  });

  it('refuses an unreadable file rather than reading it as a cold cache', () => {
    expect(() => loadCache(dir)).toThrow();
  });

  it('refuses malformed json rather than starting over', () => {
    writeFileSync(path, '{not json');
    expect(() => loadCache(path)).toThrow();
  });

  it.each([
    ['a bare array', '[]'],
    ['a json scalar', '42'],
    ['null', 'null'],
    ['a block that is not an object', '{"a.yaml": "oops"}'],
    ['a block holding a non-string', '{"a.yaml": {"k": 7}}'],
  ])('refuses %s rather than starting over', (_label, contents) => {
    writeFileSync(path, contents);
    expect(() => loadCache(path)).toThrow('not a translation cache');
  });
});
