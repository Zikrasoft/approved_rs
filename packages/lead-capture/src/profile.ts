import { Api } from 'grammy';
import type { LanguageCode } from 'grammy/types';
import type { CaptureCopy } from './copy.ts';

export async function applyBotProfile<L extends LanguageCode>(
  token: string,
  copyFor: (locale: L) => CaptureCopy,
  locales: readonly L[],
  primaryLocale: L,
): Promise<void> {
  const api = new Api(token, {
    fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
  });

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
