export {};

import { createCaseTranslator } from '@podbor/i18n/translate';
import { TRANSLATABLE_LOCALES } from '../src/i18n/config.ts';
import {
  BUSINESS_DESCRIPTION,
  TARGET_LANGUAGE_NAME,
} from '../src/i18n/translateConfig.ts';

export const WORK_DIRS = ['src/content/works', 'src/content/products'];

const { run } = createCaseTranslator({
  targetLocales: TRANSLATABLE_LOCALES,
  languageName: TARGET_LANGUAGE_NAME,
  businessDescription: BUSINESS_DESCRIPTION,
  subject: 'car repair write-ups and car part descriptions',
});

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await run(WORK_DIRS));
}
