import { afterEach, describe, it, expect, vi } from 'vitest';
import { fieldsPrompt, translateFields } from './translateFields.ts';
import {
  stubOpenAiResponse,
  stubTranslate,
  systemPrompts,
} from './mockOpenAiFetch.ts';

const OPTIONS = {
  fields: { title: 'Аккумулятор Varta', description: 'Для **японских** машин' },
  targetLocales: ['sr', 'en'] as const,
  languageName: { sr: 'Serbian (Latin script)', en: 'English' },
  businessDescription: 'CarLab, a car service in Belgrade',
  subject: 'a shop product',
  apiKey: 'test-key',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('translateFields', () => {
  it('translates every field into every locale, one request per locale', async () => {
    stubTranslate((text) => `T: ${text}`);
    const result = await translateFields(OPTIONS);
    expect(result).toEqual({
      sr: {
        title: 'T: Аккумулятор Varta',
        description: 'T: Для **японских** машин',
      },
      en: {
        title: 'T: Аккумулятор Varta',
        description: 'T: Для **японских** машин',
      },
    });
    expect(systemPrompts().sort()).toEqual(
      [
        fieldsPrompt(
          'Serbian (Latin script)',
          OPTIONS.businessDescription,
          OPTIONS.subject,
        ),
        fieldsPrompt('English', OPTIONS.businessDescription, OPTIONS.subject),
      ].sort(),
    );
  });

  it('passes a chosen model through', async () => {
    stubTranslate((text) => text);
    await translateFields({
      ...OPTIONS,
      targetLocales: ['en'],
      model: 'gpt-x',
    });
    const [, init] = (
      fetch as unknown as { mock: { calls: [string, { body: string }][] } }
    ).mock.calls[0];
    expect(JSON.parse(init.body).model).toBe('gpt-x');
  });

  it('drops keys the model invented', async () => {
    stubOpenAiResponse({
      title: 'Akumulator',
      description: 'Opis',
      extra: 'x',
    });
    const result = await translateFields({ ...OPTIONS, targetLocales: ['sr'] });
    expect(result).toEqual({
      sr: { title: 'Akumulator', description: 'Opis' },
    });
  });

  it.each([
    ['a missing key', { title: 'Akumulator' }, /missing/],
    ['a blank value', { title: 'Akumulator', description: ' ' }, /blank/],
    [
      'injected HTML',
      { title: '<script>x</script>', description: 'Opis' },
      /HTML/,
    ],
    ['a non-string value', { title: 1, description: 'Opis' }, /missing/],
    ['a non-object answer', ['Akumulator'], /expected record/i],
  ])('rejects %s', async (_label, answer, message) => {
    stubOpenAiResponse(answer);
    await expect(
      translateFields({ ...OPTIONS, targetLocales: ['sr'] }),
    ).rejects.toThrow(message);
  });

  it('makes no request when there is nothing to translate', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const result = await translateFields({ ...OPTIONS, fields: {} });
    expect(result).toEqual({ sr: {}, en: {} });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('fieldsPrompt', () => {
  it('asks for natural translation and keeps specification codes verbatim', () => {
    const prompt = fieldsPrompt('English', 'CarLab', 'a shop product');
    expect(prompt).toContain('from Russian into English for CarLab');
    expect(prompt).toContain('5W-30');
    expect(prompt).toContain('EXACTLY the same keys');
  });
});
