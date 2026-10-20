import { readFileSync } from 'node:fs';
import type { LanguageCode } from 'grammy/types';
import { z } from 'zod';
import { createSectionLoader } from '@podbor/i18n/section';
import { createTelegramClient } from '@podbor/lead-crm/telegram-client';
import { captureCopySchema, type CaptureCopy } from './copy.ts';

export interface BotProfile<L extends LanguageCode> {
  botUsername: string;
  locales: readonly L[];
  primaryLocale: L;
  manager: string;
}

const TOKEN_VARIABLE = 'TELEGRAM_CAPTURE_BOT_TOKEN';
const MANAGER_VARIABLE = 'PUBLIC_TG_MANAGER';

export async function applyBotProfile<L extends LanguageCode>(
  token: string,
  copyFor: (locale: L) => CaptureCopy,
  { botUsername, locales, primaryLocale, manager }: BotProfile<L>,
): Promise<void> {
  const { api } = createTelegramClient(token, botUsername);
  const naming = (text: string) => text.replaceAll('{manager}', `@${manager}`);

  const apply = async (locale: L, scope: { language_code?: L }) => {
    const { profile } = copyFor(locale);
    await api.setMyDescription(naming(profile.description), scope);
    await api.setMyShortDescription(naming(profile.shortDescription), scope);
    await api.setMyCommands(
      [
        { command: 'menu', description: profile.menuCommand },
        { command: 'lang', description: profile.langCommand },
      ],
      scope,
    );
  };

  await apply(primaryLocale, {});
  for (const locale of locales) await apply(locale, { language_code: locale });
}

export async function runBotProfileScript<L extends LanguageCode>(
  copyFile: URL,
  profile: Omit<BotProfile<L>, 'manager'>,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const required = (variable: string): string => {
    const value = z.string().min(1).safeParse(env[variable]);
    if (value.success) return value.data;
    console.error(`${variable} is not set`);
    return process.exit(1);
  };
  const token = required(TOKEN_VARIABLE);
  const manager = required(MANAGER_VARIABLE);
  const copyFor = createSectionLoader<L>()(
    captureCopySchema,
    readFileSync(copyFile, 'utf8'),
  );
  await applyBotProfile(token, copyFor, { ...profile, manager });
  console.log(
    `Capture bot profile set for ${profile.locales.join(', ')} (default: ${profile.primaryLocale})`,
  );
}
