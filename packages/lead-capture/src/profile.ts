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
}

const TOKEN_VARIABLE = 'TELEGRAM_CAPTURE_BOT_TOKEN';

export async function applyBotProfile<L extends LanguageCode>(
  token: string,
  copyFor: (locale: L) => CaptureCopy,
  { botUsername, locales, primaryLocale }: BotProfile<L>,
): Promise<void> {
  const { api } = createTelegramClient(token, botUsername);

  const apply = async (locale: L, scope: { language_code?: L }) => {
    const { profile } = copyFor(locale);
    await api.setMyDescription(profile.description, scope);
    await api.setMyShortDescription(profile.shortDescription, scope);
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
  profile: BotProfile<L>,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const token = z.string().min(1).safeParse(env[TOKEN_VARIABLE]);
  if (!token.success) {
    console.error(`${TOKEN_VARIABLE} is not set`);
    process.exit(1);
  }
  const copyFor = createSectionLoader<L>()(
    captureCopySchema,
    readFileSync(copyFile, 'utf8'),
  );
  await applyBotProfile(token.data, copyFor, profile);
  console.log(
    `Capture bot profile set for ${profile.locales.join(', ')} (default: ${profile.primaryLocale})`,
  );
}
