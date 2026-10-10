import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordBotApi, type RecordedBotApi } from '@podbor/lead-crm/testing';
import type { CaptureCopy } from './copy.ts';
import { applyBotProfile } from './profile.ts';

const TOKEN = 'capture-token';

const copyFor = (locale: 'ru' | 'sr' | 'en') =>
  ({
    profile: {
      description: `DESCRIPTION_${locale}`,
      shortDescription: `SHORT_${locale}`,
      menuCommand: `MENU_${locale}`,
      langCommand: `LANG_${locale}`,
    },
  }) as CaptureCopy;

let api: RecordedBotApi;

const payloads = (method: string) =>
  api.callsTo(method, TOKEN).map(({ payload }) => payload);

beforeEach(() => {
  api = recordBotApi();
  vi.stubGlobal('fetch', api.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('applying the capture bot profile', () => {
  beforeEach(async () => {
    await applyBotProfile(TOKEN, copyFor, ['ru', 'sr', 'en'], 'sr');
  });

  it('sets the description for the default and every served locale', () => {
    expect(payloads('setMyDescription')).toEqual([
      { description: 'DESCRIPTION_sr' },
      { description: 'DESCRIPTION_ru', language_code: 'ru' },
      { description: 'DESCRIPTION_sr', language_code: 'sr' },
      { description: 'DESCRIPTION_en', language_code: 'en' },
    ]);
  });

  it('sets the short description the same way', () => {
    expect(payloads('setMyShortDescription')).toEqual([
      { short_description: 'SHORT_sr' },
      { short_description: 'SHORT_ru', language_code: 'ru' },
      { short_description: 'SHORT_sr', language_code: 'sr' },
      { short_description: 'SHORT_en', language_code: 'en' },
    ]);
  });

  it('registers /menu and /lang in each language', () => {
    const commands = (locale: string) => [
      { command: 'menu', description: `MENU_${locale}` },
      { command: 'lang', description: `LANG_${locale}` },
    ];
    expect(payloads('setMyCommands')).toEqual([
      { commands: commands('sr') },
      { commands: commands('ru'), language_code: 'ru' },
      { commands: commands('sr'), language_code: 'sr' },
      { commands: commands('en'), language_code: 'en' },
    ]);
  });
});

it('stops at the first call Telegram refuses', async () => {
  api.fail('setMyDescription', 'Bad Request: description is too long');

  await expect(applyBotProfile(TOKEN, copyFor, ['ru'], 'ru')).rejects.toThrow(
    'description is too long',
  );
  expect(api.callsTo('setMyCommands', TOKEN)).toEqual([]);
});
