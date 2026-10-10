import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { createSectionLoader } from '@podbor/i18n/section';
import { captureCopySchema } from '@podbor/lead-capture/copy';
import { applyBotProfile } from '@podbor/lead-capture/profile';
import {
  PRIMARY_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from '../src/i18n/config.ts';

const token = z
  .string()
  .min(1)
  .safeParse(process.env.TELEGRAM_CAPTURE_BOT_TOKEN);
if (!token.success) {
  console.error('TELEGRAM_CAPTURE_BOT_TOKEN is not set');
  process.exit(1);
}

const copyFor = createSectionLoader<Locale>()(
  captureCopySchema,
  readFileSync(
    new URL('../src/content/i18n/captureBot.yaml', import.meta.url),
    'utf8',
  ),
);

await applyBotProfile(token.data, copyFor, SUPPORTED_LOCALES, PRIMARY_LOCALE);
console.log(
  `Capture bot profile set for ${SUPPORTED_LOCALES.join(', ')} (default: ${PRIMARY_LOCALE})`,
);
