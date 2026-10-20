import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordBotApi, type RecordedBotApi } from '@podbor/lead-crm/testing';
import type { CaptureCopy } from './copy.ts';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyBotProfile, runBotProfileScript } from './profile.ts';

const TOKEN = '2001:capture-token';

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
    await applyBotProfile(TOKEN, copyFor, {
      botUsername: 'capture_bot',
      locales: ['ru', 'sr', 'en'],
      primaryLocale: 'sr',
      manager: 'brand_manager',
    });
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

  it('names the manager wherever the copy asks for one', async () => {
    api = recordBotApi();
    vi.stubGlobal('fetch', api.fetch);

    await applyBotProfile(
      TOKEN,
      () =>
        ({
          profile: {
            description: 'Press Start, or write to {manager} directly.',
            shortDescription: 'Bot. Manager: {manager}',
            menuCommand: 'MENU',
            langCommand: 'LANG',
          },
        }) as CaptureCopy,
      {
        botUsername: 'capture_bot',
        locales: [],
        primaryLocale: 'ru',
        manager: 'brand_manager',
      },
    );

    expect(payloads('setMyDescription')).toEqual([
      { description: 'Press Start, or write to @brand_manager directly.' },
    ]);
    expect(payloads('setMyShortDescription')).toEqual([
      { short_description: 'Bot. Manager: @brand_manager' },
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

  await expect(
    applyBotProfile(TOKEN, copyFor, {
      botUsername: 'capture_bot',
      locales: ['ru'],
      primaryLocale: 'ru',
      manager: 'brand_manager',
    }),
  ).rejects.toThrow('description is too long');
  expect(api.callsTo('setMyCommands', TOKEN)).toEqual([]);
});

const FULL_COPY = {
  greeting: 'G',
  lookingFor: 'L',
  budget: 'B',
  phoneAsk: 'PA',
  phoneButton: 'PB',
  thanks: 'T',
  received: 'R',
  menu: { text: 'M', back: 'MB' },
  services: { button: 'S', text: 'ST' },
  card: { request: 'CR', site: 'CS' },
  contacts: { button: 'C', text: 'CT', hours: 'CH' },
  manager: { button: 'MG', text: 'MGT', handoff: 'MGH', chat: 'MGC' },
  partners: { button: 'P', text: 'PT' },
  request: { button: 'RQ', car: 'RC', service: 'RS', done: 'RD', unsure: 'RU' },
  language: { button: 'LG', text: 'LGT' },
  profile: {
    description: 'DESCRIPTION {manager}',
    shortDescription: 'SHORT',
    menuCommand: 'MENU',
    langCommand: 'LANG',
  },
};

describe('the profile script', () => {
  const PROFILE = {
    botUsername: 'capture_bot',
    locales: ['ru', 'en'] as const,
    primaryLocale: 'ru' as const,
  };

  function copyFile(): URL {
    const dir = mkdtempSync(join(tmpdir(), 'capture-profile-'));
    const path = join(dir, 'captureBot.yaml');
    writeFileSync(path, JSON.stringify(FULL_COPY));
    return new URL(`file://${path}`);
  }

  it('exits 1 without a manager to name', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      runBotProfileScript(copyFile(), PROFILE, {
        TELEGRAM_CAPTURE_BOT_TOKEN: TOKEN,
        PUBLIC_TG_MANAGER: '',
      }),
    ).rejects.toThrow('exit');
    expect(error).toHaveBeenCalledWith('PUBLIC_TG_MANAGER is not set');
    expect(exit).toHaveBeenCalledWith(1);
    expect(api.calls).toEqual([]);
  });

  it('exits 1 without a token', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      runBotProfileScript(copyFile(), PROFILE, {
        TELEGRAM_CAPTURE_BOT_TOKEN: '',
      }),
    ).rejects.toThrow('exit');
    expect(error).toHaveBeenCalledWith('TELEGRAM_CAPTURE_BOT_TOKEN is not set');
    expect(exit).toHaveBeenCalledWith(1);
    expect(api.calls).toEqual([]);
  });

  it('applies the copy file to the bot named by the token', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runBotProfileScript(copyFile(), PROFILE, {
      TELEGRAM_CAPTURE_BOT_TOKEN: TOKEN,
      PUBLIC_TG_MANAGER: 'brand_manager',
    });

    expect(payloads('setMyDescription')).toEqual([
      { description: 'DESCRIPTION @brand_manager' },
      { description: 'DESCRIPTION @brand_manager', language_code: 'ru' },
      { description: 'DESCRIPTION @brand_manager', language_code: 'en' },
    ]);
    expect(log).toHaveBeenCalledWith(
      'Capture bot profile set for ru, en (default: ru)',
    );
  });
});
