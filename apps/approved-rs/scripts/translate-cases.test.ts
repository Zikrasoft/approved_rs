import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import {
  hashSource,
  splitFrontmatter,
  translateCase,
  processFile,
} from './translate-cases';
import { stubOpenAiResponse, stubOpenAiFetch } from './lib/mockOpenAiFetch';

const RU_CASE = { title: 'Honda Accord', body: 'Полное описание кейса.' };

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
    const result = await translateCase(RU_CASE, 'en', 'test-key');
    expect(result).toEqual({
      title: 'Honda Accord',
      body: 'Full case writeup.',
    });
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
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cases-test-'));
    file = join(dir, 'index.md');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  function stubTranslateFetch() {
    stubOpenAiFetch((userContent) => {
      const title = /Title: (.*)/.exec(userContent)?.[1] ?? '';
      return { title: title.toUpperCase(), body: 'TRANSLATED BODY' };
    });
  }

  it('translates a case on first run and writes the hash back', async () => {
    stubTranslateFetch();
    writeFileSync(
      file,
      `---\ntitle: ${RU_CASE.title}\ntranslations: {}\n---\n${RU_CASE.body}\n`,
    );

    const result = await processFile(file, 'test-key');
    expect(result).toBe('translated');

    const raw = readFileSync(file, 'utf-8');
    const { frontmatter } = splitFrontmatter(raw);
    const doc = parseDocument(frontmatter);
    expect(doc.getIn(['translations', 'en', 'title'])).toBe(
      RU_CASE.title.toUpperCase(),
    );
    expect(typeof doc.get('translatedFrom')).toBe('string');
  });

  it('skips on a second run with no ru changes', async () => {
    stubTranslateFetch();
    writeFileSync(
      file,
      `---\ntitle: ${RU_CASE.title}\ntranslations: {}\n---\n${RU_CASE.body}\n`,
    );

    await processFile(file, 'test-key');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await processFile(file, 'test-key');
    expect(result).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
