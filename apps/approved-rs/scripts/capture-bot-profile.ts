import { APPROVED } from '@podbor/brands';
import { runBotProfileScript } from '@podbor/lead-capture/profile';
import { PRIMARY_LOCALE, SUPPORTED_LOCALES } from '../src/i18n/config.ts';

await runBotProfileScript(
  new URL('../src/content/i18n/captureBot.yaml', import.meta.url),
  {
    botUsername: APPROVED.captureBot,
    locales: SUPPORTED_LOCALES,
    primaryLocale: PRIMARY_LOCALE,
  },
);
